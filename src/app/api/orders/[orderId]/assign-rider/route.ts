import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { haversineMeters } from '@/lib/geo'
import { sendRiderAssignedEmail } from '@/lib/email'

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { riderId } = await req.json() as { riderId: string }
  if (!riderId) return NextResponse.json({ error: 'riderId required' }, { status: 400 })

  const admin = createAdminClient()

  // Verify caller is the vendor owner or admin
  const { data: order } = await admin
    .from('orders')
    .select('id, code, customer_id, status, vendors(owner_id, area_id, zone_id)')
    .eq('id', params.orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'accepted') return NextResponse.json({ error: 'Order not in accepted state' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('roles').eq('id', user.id).single()
  const vendorRow = (Array.isArray(order.vendors) ? order.vendors[0] : order.vendors) as {
    owner_id: string | null; area_id: string | null; zone_id: string | null
  } | null
  const isVendor = vendorRow?.owner_id === user.id
  const isAdmin = profile?.roles?.includes('admin') ?? false
  if (!isVendor && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify rider is available and get their location
  const { data: rider } = await admin
    .from('riders')
    .select('id, is_available, lat, lng, location_updated_at')
    .eq('id', riderId)
    .single()

  if (!rider) return NextResponse.json({ error: 'Rider not found' }, { status: 404 })
  if (!rider.is_available) return NextResponse.json({ error: 'Rider is not available' }, { status: 400 })

  // Compute pickup distance from vendor's area
  let vendorLat: number | null = null
  let vendorLng: number | null = null

  if (vendorRow?.area_id) {
    const { data: area } = await admin.from('areas').select('lat, lng').eq('id', vendorRow.area_id).single()
    vendorLat = area?.lat ?? null
    vendorLng = area?.lng ?? null
  }
  if (!vendorLat && vendorRow?.zone_id) {
    const { data: area } = await admin.from('areas').select('lat, lng').eq('zone_id', vendorRow.zone_id).maybeSingle()
    vendorLat = area?.lat ?? null
    vendorLng = area?.lng ?? null
  }

  const pickupLat = rider.lat ?? null
  const pickupLng = rider.lng ?? null
  let pickupDistanceM: number | null = null

  if (vendorLat != null && vendorLng != null && pickupLat != null && pickupLng != null) {
    pickupDistanceM = Math.round(haversineMeters(vendorLat, vendorLng, pickupLat, pickupLng))
  }

  // Assign rider with distance snapshot
  await admin.from('orders').update({
    rider_id: riderId,
    pickup_lat: pickupLat,
    pickup_lng: pickupLng,
    pickup_distance_m: pickupDistanceM,
    rider_assigned_at: new Date().toISOString(),
  }).eq('id', order.id)

  await admin.from('order_events').insert({
    order_id: order.id,
    from_status: 'accepted',
    to_status: 'accepted',
    actor_id: user.id,
    note: `Rider assigned${pickupDistanceM != null ? ` — ${pickupDistanceM} m from vendor` : ''}`,
  })

  // Email customer: rider is on the way
  const [{ data: riderProfile }, { data: customerAuth }] = await Promise.all([
    admin.from('profiles').select('full_name, phone').eq('id', riderId).single(),
    admin.auth.admin.getUserById(order.customer_id),
  ])

  const email = customerAuth.user?.email
  if (email && riderProfile) {
    sendRiderAssignedEmail({
      to: email,
      orderCode: order.code,
      riderName: riderProfile.full_name ?? 'Your rider',
      riderPhone: riderProfile.phone ?? '',
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, pickupDistanceM })
}
