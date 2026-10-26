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

    const apiKey = process.env.MONNIFY_API_KEY!
    const secretKey = process.env.MONNIFY_SECRET_KEY!
    const baseUrl = process.env.MONNIFY_BASE_URL!

    // Auth
    const authToken = Buffer.from(`${apiKey}:${secretKey}`).toString('base64')
    const tokenRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { Authorization: `Basic ${authToken}`, 'Content-Type': 'application/json' },
    })
    if (!tokenRes.ok) return NextResponse.json({ error: 'Monnify auth failed' }, { status: 500 })
    const { responseBody: { accessToken } } = await tokenRes.json()

    // Initiate refund
    const refundRes = await fetch(`${baseUrl}/api/v1/disbursements/single`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: payment.amount / 100,
        reference: `REF-${payment.reference}`,
        narration: `Dart refund for order ${orderId}`,
        destinationBankCode: '035', // Wallet / Monnify wallet
        destinationAccountNumber: payment.reference,
        currency: 'NGN',
        sourceAccountNumber: process.env.MONNIFY_CONTRACT_CODE,
      }),
    })

    const refundData = await refundRes.json()

    await admin.from('payments').update({ status: 'refunded' }).eq('id', payment.id)

    // Email customer about refund (fire-and-forget)
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

    return NextResponse.json({ refund: refundData })
  } catch (err) {
    console.error('Refund error:', err)
    return NextResponse.json({ error: 'Refund failed' }, { status: 500 })
  }
}
