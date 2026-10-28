import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { haversineMeters, formatDistance } from '@/lib/geo'
import { redirect } from 'next/navigation'
import { RiderJobClient } from './RiderJobClient'

export const dynamic = 'force-dynamic'

export default async function RiderJobPage({ params }: { params: { orderId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/rider/jobs')

  const admin = createAdminClient()

  const [{ data: order }, { data: rider }] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        *,
        order_items(name_snapshot, qty, line_total),
        vendors(id, name, area_id, areas(name, lat, lng))
      `)
      .eq('id', params.orderId)
      .eq('rider_id', user.id)
      .single(),
    admin.from('riders').select('lat, lng').eq('id', user.id).single(),
  ])

  if (!order) redirect('/rider/jobs')

  // Customer name from profiles (admin client bypasses RLS)
  const { data: customerProfile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', order.customer_id)
    .single()

  const customerName = customerProfile?.full_name ?? null

  // Distance from rider to vendor
  const vendorArea = (order.vendors as any)?.areas
  let vendorDistance: string | null = null
  if (rider?.lat && rider?.lng && vendorArea?.lat && vendorArea?.lng) {
    vendorDistance = formatDistance(haversineMeters(rider.lat, rider.lng, vendorArea.lat, vendorArea.lng))
  }

  return (
    <RiderJobClient
      order={order as any}
      vendorName={(order.vendors as any)?.name ?? 'Vendor'}
      vendorAreaName={vendorArea?.name ?? null}
      vendorDistance={vendorDistance}
      customerName={customerName}
      orderItems={(order.order_items as any[]) ?? []}
    />
  )
}
