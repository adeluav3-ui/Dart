import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { haversineMeters, formatDistance, formatLocationAge, STALE_MS } from '@/lib/geo'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const vendorId = searchParams.get('vendorId')
  if (!vendorId) return NextResponse.json({ error: 'vendorId required' }, { status: 400 })

  const admin = createAdminClient()

  // Verify caller owns this vendor
  const { data: vendor } = await admin
    .from('vendors')
    .select('id, lat, lng, area_id, zone_id')
    .eq('id', vendorId)
    .eq('owner_id', user.id)
    .single()

  if (!vendor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Use vendor's direct lat/lng pin; fall back to area coordinates
  let vendorLat: number | null = vendor.lat ?? null
  let vendorLng: number | null = vendor.lng ?? null

  if (vendorLat == null && vendor.area_id) {
    const { data: area } = await admin
      .from('areas')
      .select('lat, lng')
      .eq('id', vendor.area_id)
      .single()
    vendorLat = area?.lat ?? null
    vendorLng = area?.lng ?? null
  }

  if (vendorLat == null && vendor.zone_id) {
    const { data: area } = await admin
      .from('areas')
      .select('lat, lng')
      .eq('zone_id', vendor.zone_id)
      .maybeSingle()
    vendorLat = area?.lat ?? null
    vendorLng = area?.lng ?? null
  }

  // Fetch ALL active riders — fresh and stale alike
  const staleThreshold = new Date(Date.now() - STALE_MS).toISOString()
  const { data: rawRiders } = await admin
    .from('riders')
    .select('id, lat, lng, location_accuracy, location_updated_at, is_available, profiles(full_name, phone)')
    .eq('is_active', true)

  if (!rawRiders || rawRiders.length === 0) {
    return NextResponse.json({ riders: [] })
  }

  // Fetch all areas with coordinates (for nearest-area lookup)
  const { data: allAreas } = await admin
    .from('areas')
    .select('id, name, lat, lng')
    .eq('status', 'active')
    .not('lat', 'is', null)

  // Check which riders have active orders from this vendor
  const { data: activeOrders } = await admin
    .from('orders')
    .select('rider_id')
    .eq('vendor_id', vendorId)
    .in('status', ['accepted', 'ready', 'picked_up'])
    .not('rider_id', 'is', null)

  const vendorActiveRiderIds = new Set((activeOrders ?? []).map(o => o.rider_id as string))

  type RiderRow = {
    id: string
    lat: number | null
    lng: number | null
    location_accuracy: number | null
    location_updated_at: string | null
    is_available: boolean
    profiles: { full_name: string | null; phone: string | null } | { full_name: string | null; phone: string | null }[] | null
  }

  const riders = (rawRiders as unknown as RiderRow[]).map(r => {
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    const locationFresh = !!r.location_updated_at && r.location_updated_at >= staleThreshold

    let distanceM: number | null = null
    let distanceLabel = '—'
    if (vendorLat != null && vendorLng != null && r.lat != null && r.lng != null) {
      distanceM = Math.round(haversineMeters(vendorLat, vendorLng, r.lat, r.lng))
      distanceLabel = formatDistance(distanceM)
    }

    let nearestArea = ''
    if (r.lat != null && r.lng != null && allAreas) {
      let minDist = Infinity
      for (const a of allAreas) {
        if (a.lat == null || a.lng == null) continue
        const d = haversineMeters(r.lat, r.lng, a.lat, a.lng)
        if (d < minDist) { minDist = d; nearestArea = a.name }
      }
    }

    return {
      id: r.id,
      name: profile?.full_name ?? 'Rider',
      phone: profile?.phone ?? null,
      nearestArea,
      distanceM,
      distanceLabel,
      locationAgeLabel: r.location_updated_at ? formatLocationAge(r.location_updated_at) : 'Location unknown',
      locationFresh,
      hasOrderFromVendor: vendorActiveRiderIds.has(r.id),
    }
  })

  // Fresh-location riders first (sub-sorted: vendor order first, then distance)
  // Unknown-location riders after (sub-sorted: vendor order first, then name)
  riders.sort((a, b) => {
    if (a.locationFresh !== b.locationFresh) return a.locationFresh ? -1 : 1
    if (a.hasOrderFromVendor !== b.hasOrderFromVendor) return a.hasOrderFromVendor ? -1 : 1
    if (a.locationFresh && b.locationFresh) {
      return (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity)
    }
    return a.name.localeCompare(b.name)
  })

  return NextResponse.json({ riders })
}
