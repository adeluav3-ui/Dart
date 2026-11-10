import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const supabase = createClient()
  const admin = createAdminClient()
  const { orderId } = params

  // Must be the order owner
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  // Load order — must belong to this customer and be pending payment
  const { data: order } = await admin
    .from('orders')
    .select('id, status, customer_id')
    .eq('id', orderId)
    .eq('customer_id', user.id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'pending_payment') {
    // Already past payment — nothing to do
    return NextResponse.json({ paid: order.status !== 'pending_payment' })
  }

  // Find the pending payment row for this order
  const { data: payment } = await admin
    .from('payments')
    .select('reference, amount, status')
    .eq('order_id', orderId)
    .eq('provider', 'monnify')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!payment || !payment.reference) {
    return NextResponse.json({ paid: false, reason: 'no_payment_row' })
  }

  if (payment.status === 'paid') {
    // Payment row is paid but order wasn't transitioned — fix it now
    await admin.rpc('transition_order', {
      p_order_id: orderId,
      p_to_status: 'paid',
      p_note: 'Payment already confirmed — recovery via verify-payment',
    })
    return NextResponse.json({ paid: true })
  }

  // Query Monnify for the actual transaction status
  const apiKey = process.env.MONNIFY_API_KEY!
  const secretKey = process.env.MONNIFY_SECRET_KEY!
  const baseUrl = process.env.MONNIFY_BASE_URL!

  const encoded = Buffer.from(`${apiKey}:${secretKey}`).toString('base64')
  const authRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' },
  }).catch(() => null)

  if (!authRes?.ok) {
    return NextResponse.json({ paid: false, reason: 'monnify_auth_failed' })
  }

  const { responseBody: { accessToken } } = await authRes.json()

  const statusRes = await fetch(
    `${baseUrl}/api/v2/merchant/transactions/query?paymentReference=${encodeURIComponent(payment.reference)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  ).catch(() => null)

  if (!statusRes?.ok) {
    return NextResponse.json({ paid: false, reason: 'monnify_query_failed' })
  }

  const { responseBody: txn } = await statusRes.json()

  if (txn?.paymentStatus !== 'PAID') {
    return NextResponse.json({ paid: false, reason: 'not_paid_in_monnify' })
  }

  const paidKobo = Math.round((txn.amountPaid ?? 0) * 100)
  if (paidKobo < payment.amount) {
    return NextResponse.json({ paid: false, reason: 'underpayment' })
  }

  // Monnify confirms paid — mark payment and transition order
  await admin.from('payments').update({
    status: 'paid',
    raw_webhook: txn,
  }).eq('reference', payment.reference)

  const { error: transitionErr } = await admin.rpc('transition_order', {
    p_order_id: orderId,
    p_to_status: 'paid',
    p_note: `Monnify confirmed via verify-payment: ${txn.transactionReference}`,
  })

  if (transitionErr) {
    console.error('[verify-payment] transition_order failed:', transitionErr.message)
    return NextResponse.json({ paid: false, reason: 'transition_failed' })
  }

  return NextResponse.json({ paid: true })
}
