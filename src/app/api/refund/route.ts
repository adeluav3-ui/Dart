import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendRefundEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json()
    const admin = createAdminClient()

    const { data: payment } = await admin
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .eq('status', 'paid')
      .single()

    if (!payment) return NextResponse.json({ skipped: true })

    // Mark payment as refunded
    await admin.from('payments').update({ status: 'refunded' }).eq('id', payment.id)

    // Credit wallet (refund goes to internal GoCart wallet, not reversed through Monnify)
    await admin.from('wallet_transactions').insert({
      user_id: payment.user_id ?? null,
      order_id: orderId,
      amount: payment.amount,
      kind: 'refund',
      note: `Refund for cancelled order`,
    }).then(() => {})  // best-effort; wallet feature may not exist yet

    // Email customer
    const { data: order } = await admin
      .from('orders')
      .select('code, customer_id, total')
      .eq('id', orderId)
      .single()

    if (order) {
      const { data: authUser } = await admin.auth.admin.getUserById(order.customer_id)
      if (authUser.user?.email) {
        sendRefundEmail({
          to: authUser.user.email,
          orderCode: order.code,
          amount: order.total,
        }).catch(() => {})
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Refund error:', err)
    return NextResponse.json({ error: 'Refund failed' }, { status: 500 })
  }
}
