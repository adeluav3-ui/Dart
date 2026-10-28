import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { bank: string; account_no: string; account_name: string }

  const admin = createAdminClient()

  const { data: rider } = await admin.from('riders').select('id').eq('id', user.id).single()
  if (!rider) return NextResponse.json({ error: 'Not a registered rider' }, { status: 403 })

  const { error } = await admin.from('riders').update({
    payout_bank: body.bank,
    payout_account_no: body.account_no,
    payout_account_name: body.account_name,
  }).eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
