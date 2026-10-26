import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendOrderPaidEmail } from '@/lib/email'
import { sendVendorPush } from '@/lib/webpush'

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text()
    const body = JSON.parse(raw)

    // 1. Verify signature
    const signature = req.headers.get('monnify-signature') ?? ''
    const secretKey = process.env.MONNIFY_SECRET_KEY!
    const computed = createHmac('sha512', secretKey).update(raw).digest('hex')

    if (computed !== signature) {
      console.error('Monnify webhook: invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const { eventType, eventData } = body

    if (eventType !== 'SUCCESSFUL_TRANSACTION') {
      // Not a payment success — acknowledge and ignore
      return NextResponse.json({ received: true })
    }

    const { paymentReference, amountPaid, transactionReference } = eventData

    const admin = createAdminClient()

    // 2. Find payment row — idempotent: if already paid, skip
    const { data: payment } = await admin
      .from('payments')
      .select('*, orders(*)')
      .eq('reference', paymentReference)
      .single()

    if (!payment) {
      console.error('Webhook: payment reference not found', paymentReference)
      return NextResponse.json({ error: 'Reference not found' }, { status: 404 })
    }

    if (payment.status === 'paid') {
      // Already processed — idempotent
      return NextResponse.json({ received: true })
    }

    // 3. Verify amount (Monnify sends naira; our amount is kobo)
    const expectedKobo = payment.amount
    const paidKobo = Math.round(amountPaid * 100)

    if (paidKobo < expectedKobo) {
      console.error('Webhook: underpayment', { expectedKobo, paidKobo })
      return NextResponse.json({ error: 'Underpayment' }, { status: 400 })
    }

    // 4. Mark payment as paid
    await admin
      .from('payments')
      .update({
        status: 'paid',
        raw_webhook: body,
      })
      .eq('reference', paymentReference)

    // 5. Transition order to paid (uses the Postgres state machine function)
    const order = payment.orders as { id: string; status: string }
    if (order.status !== 'pending_payment') {
      // Already moved on
      return NextResponse.json({ received: true })
    }

    await admin.rpc('transition_order', {
      p_order_id: order.id,
      p_to_status: 'paid',
      p_note: `Monnify: ${transactionReference}`,
    })

    // 6. Email customer their PIN (fire-and-forget)
    const fullOrder = await admin
      .from('orders')
      .select('code, delivery_pin, total, customer_id, vendor_id')
      .eq('id', order.id)
      .single()

    if (fullOrder.data) {
      // Email customer their PIN
      const { data: customerAuth } = await admin.auth.admin.getUserById(
        fullOrder.data.customer_id
      )
      if (customerAuth.user?.email) {
        sendOrderPaidEmail({
          to: customerAuth.user.email,
          orderCode: fullOrder.data.code,
          deliveryPin: fullOrder.data.delivery_pin,
          total: fullOrder.data.total,
          orderId: order.id,
        }).catch(() => {})
      }

      // Web push to vendor — repeated every 60 s on the vendor board until accepted/rejected
      const { data: vendorRow } = await admin
        .from('vendors')
        .select('owner_id, name')
        .eq('id', fullOrder.data.vendor_id)
        .single()
      if (vendorRow?.owner_id) {
        sendVendorPush(vendorRow.owner_id, {
          type: 'new_order',
          orderId: order.id,
          orderCode: fullOrder.data.code,
          vendorName: vendorRow.name,
        }).catch(() => {})
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Monnify webhook error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
