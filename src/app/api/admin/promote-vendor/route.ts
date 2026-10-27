import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('roles').eq('id', user.id).single()
  if (!profile?.roles?.includes('admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, businessName, slug, type, zoneId, commissionRate, avgPrepMins } = await req.json()
  if (!userId || !businessName || !slug || !type || !zoneId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { error: vendorErr } = await admin.from('vendors').insert({
    owner_id: userId,
    name: businessName,
    slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    type,
    zone_id: zoneId,
    is_verified: true,
    is_open: false,
    avg_prep_mins: avgPrepMins ?? 30,
    commission_rate: commissionRate ?? 0.10,
    rating_avg: 0,
    rating_count: 0,
  })
  if (vendorErr) return NextResponse.json({ error: vendorErr.message }, { status: 500 })

  // Append 'vendor' to roles; trigger keeps role column in sync
  const { data: target } = await admin.from('profiles').select('roles').eq('id', userId).single()
  const existing: string[] = target?.roles ?? ['customer']
  if (!existing.includes('vendor')) {
    const { error: roleErr } = await admin
      .from('profiles')
      .update({ roles: [...existing, 'vendor'] })
      .eq('id', userId)
    if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
