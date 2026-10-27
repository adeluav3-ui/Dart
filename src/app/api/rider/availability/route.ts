import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    available: boolean
    lat?: number
    lng?: number
    accuracy?: number
  }

  const admin = createAdminClient()

  // Verify caller is a rider
  const { data: rider } = await admin
    .from('riders')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!rider) return NextResponse.json({ error: 'Not a registered rider' }, { status: 403 })

  const update: Record<string, unknown> = { is_available: body.available }

  if (body.available && body.lat != null && body.lng != null) {
    update.lat = body.lat
    update.lng = body.lng
    update.location_accuracy = body.accuracy ?? null
    update.location_updated_at = new Date().toISOString()
  }

  if (!body.available) {
    update.is_available = false
  }

  const { error } = await admin
    .from('riders')
    .update(update)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
