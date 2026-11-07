import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DAILY_CAP = 400

async function overDailyCap(): Promise<boolean> {
  const admin = createAdminClient()
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
  const { count } = await admin
    .from('google_call_log')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'places_details')
    .gte('called_at', todayStart)
  return (count ?? 0) >= DAILY_CAP
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const placeId = searchParams.get('placeId')?.trim()
  const sessionToken = searchParams.get('sessionToken')?.trim()

  if (!placeId) {
    return NextResponse.json({ error: 'placeId required' }, { status: 400 })
  }

  if (await overDailyCap()) {
    return NextResponse.json({ unavailable: true })
  }

  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY
  if (!apiKey) {
    return NextResponse.json({ unavailable: true })
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)

    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`)
    if (sessionToken) url.searchParams.set('sessionToken', sessionToken)

    const res = await fetch(url.toString(), {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'location',
      },
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!res.ok) {
      return NextResponse.json({ unavailable: true })
    }

    const data = await res.json()
    const lat = data?.location?.latitude
    const lng = data?.location?.longitude

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ unavailable: true })
    }

    // Log the call (fire-and-forget)
    const admin = createAdminClient()
    admin.from('google_call_log').insert({ type: 'places_details' }).then(() => {})

    return NextResponse.json({ lat, lng })
  } catch {
    return NextResponse.json({ unavailable: true })
  }
}
