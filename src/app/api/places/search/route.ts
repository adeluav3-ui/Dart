import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ── In-memory rate limiter: 30 req/min per IP ─────────────────────────────
const rateMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60 * 1000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || now >= entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// ── Bounding-box cache (10 min) ──────────────────────────────────────────
interface BBox { minLat: number; maxLat: number; minLng: number; maxLng: number }
let bboxCache: { bbox: BBox; expiresAt: number } | null = null
const BBOX_TTL_MS = 10 * 60 * 1000
const EXTEND_M = 3000 // 3 km extension

function metersToLat(m: number) { return m / 111320 }
function metersToLng(m: number, lat: number) { return m / (111320 * Math.cos(lat * Math.PI / 180)) }

async function getBbox(): Promise<BBox | null> {
  const now = Date.now()
  if (bboxCache && now < bboxCache.expiresAt) return bboxCache.bbox

  const admin = createAdminClient()
  const { data: areas } = await admin
    .from('areas')
    .select('lat, lng')
    .eq('is_active', true)
    .eq('status', 'active')
    .not('lat', 'is', null)
    .not('lng', 'is', null)

  if (!areas || areas.length === 0) return null

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
  for (const a of areas) {
    if (a.lat < minLat) minLat = a.lat
    if (a.lat > maxLat) maxLat = a.lat
    if (a.lng < minLng) minLng = a.lng
    if (a.lng > maxLng) maxLng = a.lng
  }

  const midLat = (minLat + maxLat) / 2
  const dLat = metersToLat(EXTEND_M)
  const dLng = metersToLng(EXTEND_M, midLat)

  const bbox: BBox = {
    minLat: minLat - dLat,
    maxLat: maxLat + dLat,
    minLng: minLng - dLng,
    maxLng: maxLng + dLng,
  }
  bboxCache = { bbox, expiresAt: now + BBOX_TTL_MS }
  return bbox
}

// ── Daily cap check ───────────────────────────────────────────────────────
const DAILY_CAP = 400

async function overDailyCap(type: string): Promise<boolean> {
  const admin = createAdminClient()
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
  const { count } = await admin
    .from('google_call_log')
    .select('id', { count: 'exact', head: true })
    .eq('type', type)
    .gte('called_at', todayStart)
  return (count ?? 0) >= DAILY_CAP
}

// ── Route handler ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Rate limit
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let input: string, sessionToken: string
  try {
    const body = await req.json()
    input = (body.input ?? '').trim()
    sessionToken = body.sessionToken ?? ''
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (input.length < 3) {
    return NextResponse.json({ error: 'Input too short' }, { status: 400 })
  }

  // Daily cap
  if (await overDailyCap('places_search')) {
    console.error('[places/search] daily cap reached')
    return NextResponse.json({ unavailable: true })
  }

  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY
  if (!apiKey) {
    console.error('[places/search] GOOGLE_MAPS_SERVER_KEY not set')
    return NextResponse.json({ unavailable: true })
  }

  const bbox = await getBbox()
  if (!bbox) {
    console.error('[places/search] no active areas with coordinates — bbox is null')
    return NextResponse.json({ unavailable: true })
  }
  console.log('[places/search] key ok, bbox ok — calling Google Places API')

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)

    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat',
      },
      body: JSON.stringify({
        input,
        sessionToken,
        includedRegionCodes: ['ng'],
        locationRestriction: {
          rectangle: {
            low:  { latitude: bbox.minLat, longitude: bbox.minLng },
            high: { latitude: bbox.maxLat, longitude: bbox.maxLng },
          },
        },
      }),
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[places/search] Google API error', res.status, errText)
      return NextResponse.json({ unavailable: true })
    }

    const data = await res.json()
    const suggestions = data?.suggestions ?? []

    const results = suggestions
      .slice(0, 5)
      .map((s: any) => {
        const p = s?.placePrediction
        if (!p?.placeId) return null
        return {
          placeId: p.placeId,
          main: p.structuredFormat?.mainText?.text ?? '',
          secondary: p.structuredFormat?.secondaryText?.text ?? '',
        }
      })
      .filter(Boolean)

    // Log the call (fire-and-forget)
    const admin = createAdminClient()
    admin.from('google_call_log').insert({ type: 'places_search' }).then(() => {})

    return NextResponse.json({ results })
  } catch (err) {
    console.error('[places/search] fetch threw', err)
    return NextResponse.json({ unavailable: true })
  }
}
