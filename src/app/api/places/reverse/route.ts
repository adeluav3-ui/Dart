import 'server-only'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get('lat') ?? '')
  const lng = parseFloat(req.nextUrl.searchParams.get('lng') ?? '')

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ name: '' }, { status: 400 })
  }

  // Google Geocoding API — much better Nigeria coverage than Nominatim
  const googleKey = process.env.GOOGLE_MAPS_SERVER_KEY
  if (googleKey) {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleKey}&language=en`,
        { signal: AbortSignal.timeout(4000) }
      )
      if (res.ok) {
        const data = await res.json()
        if (data.status === 'OK' && data.results?.length > 0) {
          type Component = { types: string[]; long_name: string }
          const components: Component[] = data.results[0].address_components ?? []
          const get = (type: string) =>
            components.find((c: Component) => c.types.includes(type))?.long_name ?? ''

          const route          = get('route')
          const sublocalityL1  = get('sublocality_level_1')
          const sublocality    = get('sublocality')
          const neighborhood   = get('neighborhood')
          const locality       = get('locality') || get('administrative_area_level_2')

          const specific = route || sublocalityL1 || sublocality || neighborhood || ''
          const name = specific && locality
            ? `${specific}, ${locality}`
            : specific || locality || ''

          if (name) return NextResponse.json({ name })
        }
      }
    } catch {}
  }

  // Fallback: Nominatim (OpenStreetMap)
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
