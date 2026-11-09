import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MIN_TOPUP_KOBO = 10_000   // ₦100
const MAX_TOPUP_KOBO = 5_000_000 // ₦50,000

let _tokenCache: { token: string; expiresAt: number } | null = null

async function getMonnifyToken(): Promise<string | null> {
  if (_tokenCache && _tokenCache.expiresAt > Date.now() + 60_000) {
    return _tokenCache.token
  }
  const apiKey = process.env.MONNIFY_API_KEY!
  const secretKey = process.env.MONNIFY_SECRET_KEY!
  const baseUrl = process.env.MONNIFY_BASE_URL!
  const encoded = Buffer.from(`${apiKey}:${secretKey}`).toString('base64')
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) return null
  const { responseBody } = await res.json()
  _tokenCache = {
    token: responseBody.accessToken,
    expiresAt: Date.now() + (responseBody.expiresIn ?? 3600) * 1000,
  }
  return _tokenCache.token
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { amount?: number }
  const amount = body.amount

  if (!amount || typeof amount !== 'number' || !Number.isInteger(amount)) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }
  if (amount < MIN_TOPUP_KOBO) {
    return NextResponse.json({ error: `Minimum top-up is ₦${MIN_TOPUP_KOBO / 100}` }, { status: 400 })
  }
  if (amount > MAX_TOPUP_KOBO) {
    return NextResponse.json({ error: `Maximum top-up is ₦${MAX_TOPUP_KOBO / 100}` }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: authData } = await admin.auth.admin.getUserById(user.id)
  const email = authData.user?.email ?? `${user.id.replace(/-/g, '').slice(0, 8)}@wallet.gocart.app`

  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', user.id).single()
  const name = (profile as { full_name: string | null } | null)?.full_name ?? 'Customer'

  const reference = `GCW-${user.id.replace(/-/g, '').slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`

  const { error: paymentErr } = await admin.from('payments').insert({
    order_id: null,
    reference,
    provider: 'monnify',
    amount,
    status: 'pending',
    type: 'wallet_topup',
    topup_user_id: user.id,
  })

  if (paymentErr) {
    console.error('Topup payment insert error:', paymentErr)
    return NextResponse.json({ error: 'Failed to initialise payment' }, { status: 500 })
  }

  const accessToken = await getMonnifyToken()
  if (!accessToken) {
    return NextResponse.json({ error: 'Payment provider unavailable' }, { status: 500 })
  }

  const baseUrl = process.env.MONNIFY_BASE_URL!
  const contractCode = process.env.MONNIFY_CONTRACT_CODE!
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  const txRes = await fetch(`${baseUrl}/api/v1/merchant/transactions/init-transaction`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amount / 100,
      customerName: name,
      customerEmail: email,
      paymentDescription: 'GoCart wallet top-up',
      paymentReference: reference,
      currencyCode: 'NGN',
      contractCode,
      redirectUrl: `${appUrl}/wallet?topup=1`,
      paymentMethods: ['CARD', 'ACCOUNT_TRANSFER', 'USSD'],
    }),
  })

  if (!txRes.ok) {
    console.error('Monnify topup init failed:', await txRes.text())
    return NextResponse.json({ error: 'Payment initialisation failed' }, { status: 500 })
  }

  const { responseBody: { checkoutUrl } } = await txRes.json()
  return NextResponse.json({ checkoutUrl, reference })
}
