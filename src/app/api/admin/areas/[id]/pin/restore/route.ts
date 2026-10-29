import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('roles').eq('id', user.id).single()
  if (!profile?.roles?.includes('admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: prev } = await admin
    .from('area_pin_history')
    .select('*')
    .eq('area_id', params.id)
    .order('replaced_at', { ascending: false })
    .limit(1)
    .single()

  if (!prev) return NextResponse.json({ error: 'No previous pin' }, { status: 404 })

  await admin.from('areas').update({
    lat: prev.lat,
    lng: prev.lng,
    accuracy_m: prev.accuracy_m,
    pin_saved_at: prev.saved_at,
    pin_saved_by: prev.saved_by,
  }).eq('id', params.id)

  return NextResponse.json({ ok: true, restored: prev })
}
