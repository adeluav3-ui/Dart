import { createAdminClient } from '@/lib/supabase/admin'

export interface RoadDistanceResult {
  distance_m: number
  source: 'google' | 'cache' | 'estimate'
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function fallback(vendorLat: number, vendorLng: number, pinLat: number, pinLng: number): number {
  return Math.round(haversineMeters(vendorLat, vendorLng, pinLat, pinLng) * 1.35)
}

function cacheKey(vendorLat: number, vendorLng: number, pinLat: number, pinLng: number): string {
  return `${round3(vendorLat)},${round3(vendorLng)}_${round3(pinLat)},${round3(pinLng)}`
}

export async function getRoadDistance(
  vendorLat: number,
  vendorLng: number,
  pinLat: number,
  pinLng: number
): Promise<RoadDistanceResult> {
  const admin = createAdminClient()
  const key = cacheKey(vendorLat, vendorLng, pinLat, pinLng)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Cache lookup
  const { data: cached } = await admin
    .from('route_distance_cache')
    .select('distance_m')
    .eq('key', key)
    .gte('created_at', thirtyDaysAgo)
    .maybeSingle()

  if (cached) {
    return { distance_m: cached.distance_m, source: 'cache' }
  }

  // 2. Daily cap check
  const [{ data: settings }, { count }] = await Promise.all([
    admin.from('delivery_pricing_settings').select('daily_google_call_cap').eq('id', 1).single(),
    admin.from('google_call_log').select('id', { count: 'exact', head: true })
      .gte('called_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
  ])

  const cap = settings?.daily_google_call_cap ?? 400
  if ((count ?? 0) >= cap) {
    return { distance_m: fallback(vendorLat, vendorLng, pinLat, pinLng), source: 'estimate' }
  }

  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY
  if (!apiKey) {
    return { distance_m: fallback(vendorLat, vendorLng, pinLat, pinLng), source: 'estimate' }
  }

  // 3. Google Routes API
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)

    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
      },
      body: JSON.stringify({
        origin:      { location: { latLng: { latitude: vendorLat, longitude: vendorLng } } },
        destination: { location: { latLng: { latitude: pinLat,    longitude: pinLng    } } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
      }),
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!res.ok) {
      return { distance_m: fallback(vendorLat, vendorLng, pinLat, pinLng), source: 'estimate' }
    }

    const data = await res.json()
    const distanceM = data?.routes?.[0]?.distanceMeters

    if (typeof distanceM !== 'number') {
      return { distance_m: fallback(vendorLat, vendorLng, pinLat, pinLng), source: 'estimate' }
    }

    // Log + cache (fire-and-forget, non-blocking)
    admin.from('google_call_log').insert({}).then(() => {})
    admin.from('route_distance_cache').upsert({ key, distance_m: distanceM }).then(() => {})

    return { distance_m: distanceM, source: 'google' }
  } catch {
    return { distance_m: fallback(vendorLat, vendorLng, pinLat, pinLng), source: 'estimate' }
  }
}
