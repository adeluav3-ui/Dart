import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyAccount } from '@/lib/monnify'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const bankCode     = req.nextUrl.searchParams.get('bankCode') ?? ''
  const accountNumber = req.nextUrl.searchParams.get('accountNumber') ?? ''

  if (!bankCode || accountNumber.length < 10) {
    return NextResponse.json({ error: 'bankCode and accountNumber are required' }, { status: 400 })
  }

  try {
    const name = await verifyAccount(bankCode, accountNumber)
    if (!name) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    return NextResponse.json({ name })
  } catch {
    return NextResponse.json({ error: 'Verification failed' }, { status: 502 })
  }
}
