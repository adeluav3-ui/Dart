import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentVersion } from '@/lib/legal'

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

  // Terms enforcement — only block going available, not going offline
  if (body.available) {
    const version = getCurrentVersion('rider_agreement')
    const { data: row } = await admin
      .from('legal_acceptances')
      .select('id')
      .eq('user_id', user.id)
      .eq('document_slug', 'rider_agreement')
      .eq('document_version', version)
      .maybeSingle()
    if (!row) {
      return NextResponse.json(
        { error: 'Please accept our updated terms to continue.', code: 'TERMS_NOT_ACCEPTED' },
        { status: 403 }
      )
    }
  }

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
