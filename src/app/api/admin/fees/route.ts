import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_KEYS = [
  'service_fee_enabled',
  'service_fee_type',
  'service_fee_percent',
  'service_fee_min',
  'service_fee_max',
  'service_fee_flat',
]

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('roles').eq('id', user.id).single()
  if (!profile?.roles?.includes('admin'))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as Record<string, string>
  const updates = Object.entries(body)
    .filter(([k]) => ALLOWED_KEYS.includes(k))
    .map(([key, value]) => ({ key, value: String(value), updated_at: new Date().toISOString() }))

  if (!updates.length) return NextResponse.json({ ok: true })

  const admin = createAdminClient()
  const { error } = await admin.from('app_settings').upsert(updates, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
