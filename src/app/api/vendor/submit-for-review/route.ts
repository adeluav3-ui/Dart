import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAdminVendorReviewEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { vendorId } = await req.json()
  if (!vendorId) return NextResponse.json({ error: 'vendorId required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: vendor } = await admin
    .from('vendors')
    .select('id, name, is_verified')
    .eq('id', vendorId)
    .eq('owner_id', user.id)
    .single()

  if (!vendor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (vendor.is_verified) return NextResponse.json({ ok: true })

  await sendAdminVendorReviewEmail({
    vendorName: vendor.name,
    vendorId: vendor.id,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
