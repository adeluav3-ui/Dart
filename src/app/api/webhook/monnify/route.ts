import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

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
      .update({ status: 'paid', raw_webhook: body })
      .eq('reference', paymentReference)

    // 5a. Wallet top-up — credit the customer ledger
    if ((payment as { type?: string }).type === 'wallet_topup') {
      const topupUserId = (payment as { topup_user_id?: string }).topup_user_id
      if (!topupUserId) {
        console.error('Webhook: wallet_topup payment missing topup_user_id', paymentReference)
        return NextResponse.json({ received: true })
      }
      await admin.from('ledger_entries').insert({
        order_id: null,
        party_type: 'customer',
        party_id: topupUserId,
        amount: payment.amount,
        kind: 'topup',
        note: `Wallet top-up · ${transactionReference}`,
      })
      return NextResponse.json({ received: true })
    }

    // 5b. Order payment — transition order to paid
    const order = payment.orders as { id: string; status: string }
    if (order.status !== 'pending_payment') {
      // Already moved on
      return NextResponse.json({ received: true })
    }

    const { error: transitionErr } = await admin.rpc('transition_order', {
      p_order_id: order.id,
      p_to_status: 'paid',
      p_note: `Monnify: ${transactionReference}`,
    })
    if (transitionErr) {
      console.error('[webhook] transition_order failed:', transitionErr.message, { orderId: order.id })
    }

    // If there was a partial wallet deduction recorded on the order, apply it now
    const walletApplied = (order as { wallet_applied_kobo?: number }).wallet_applied_kobo ?? 0
    if (walletApplied > 0) {
      const { data: orderRow } = await admin
        .from('orders').select('customer_id').eq('id', order.id).single()
      if (orderRow) {
        await admin.from('ledger_entries').insert({
          order_id: order.id,
          party_type: 'customer',
          party_id: (orderRow as { customer_id: string }).customer_id,
          amount: walletApplied,
          kind: 'adjustment',
          note: 'Wallet credit applied at checkout',
        })
      }
    }

    // Notifications (receipt email + vendor push) are sent by the
    // _notify_on_order_event trigger inside transition_order above.

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Monnify webhook error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
