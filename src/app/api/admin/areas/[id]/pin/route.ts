import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('roles').eq('id', user.id).single()
  if (!profile?.roles?.includes('admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { lat, lng, accuracy_m } = await req.json()
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })
  }

  // Archive existing pin to history before overwriting
  const { data: current } = await admin
    .from('areas')
    .select('lat, lng, accuracy_m, pin_saved_at, pin_saved_by')
    .eq('id', params.id)
    .single()

  if (current?.lat != null && current?.lng != null) {
    await admin.from('area_pin_history').insert({
      area_id: params.id,
      lat: current.lat,
      lng: current.lng,
      accuracy_m: current.accuracy_m ?? null,
      saved_at: current.pin_saved_at ?? new Date().toISOString(),
      saved_by: current.pin_saved_by ?? null,
    })
  }

  await admin.from('areas').update({
    lat,
    lng,
    accuracy_m: typeof accuracy_m === 'number' ? accuracy_m : null,
    pin_saved_at: new Date().toISOString(),
    pin_saved_by: user.id,
  }).eq('id', params.id)

  return NextResponse.json({ ok: true })
}
