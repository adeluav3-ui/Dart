import 'server-only'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get('lat') ?? '')
  const lng = parseFloat(req.nextUrl.searchParams.get('lng') ?? '')

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ name: '' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`,
      {
        headers: { 'User-Agent': 'GoCart-Delivery/1.0 (gocart.ng)' },
        signal: AbortSignal.timeout(4000),
      }
    )
    if (!res.ok) return NextResponse.json({ name: '' })

    const data = await res.json()
    const addr = data.address ?? {}

    // Build a short, friendly name: specific place + neighbourhood/suburb
    const specific =
      addr.amenity || addr.building || addr.shop || addr.office ||
      addr.leisure || addr.tourism || addr.road || addr.pedestrian || ''
    const area =
      addr.suburb || addr.neighbourhood || addr.village ||
      addr.town || addr.city_district || addr.city || ''

    const parts = [specific, area].filter(Boolean)
    const name = parts.length > 0
      ? parts.join(', ')
      : (data.display_name?.split(',').slice(0, 2).join(',').trim() ?? '')

    return NextResponse.json({ name })
  } catch {
    return NextResponse.json({ name: '' })
  }
}
