import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { haversineMeters } from '@/lib/geo'
import { RiderJobsClient } from './RiderJobsClient'
import type { Area } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function RiderJobsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    { data: profile },
    { data: rider },
    { data: activeOrders },
    { data: todayLedger },
    { data: areas },
  ] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    admin.from('riders').select('is_available, lat, lng, location_updated_at').eq('id', user.id).single(),
    supabase
      .from('orders')
      .select('id, code, status, area_name, address_zone, vendor_id, rider_pay, assigned_at:rider_assigned_at, vendors(name)')
      .eq('rider_id', user.id)
      .in('status', ['accepted', 'ready', 'picked_up'])
      .order('rider_assigned_at', { ascending: true }),
    admin
      .from('ledger_entries')
      .select('amount')
      .eq('party_id', user.id)
      .eq('party_type', 'rider')
      .gte('created_at', today.toISOString()),
    admin.from('areas').select('id, name, lat, lng').not('lat', 'is', null),
  ])

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Rider'
  const todayAmount = (todayLedger ?? []).reduce((s: number, e: { amount: number }) => s + e.amount, 0)
  const todayTrips = todayLedger?.length ?? 0

  // Find nearest area to rider's current location
  let nearestArea: string | null = null
  if (rider?.lat && rider?.lng && areas) {
    const sorted = (areas as Area[])
      .filter(a => a.lat && a.lng)
      .map(a => ({ name: a.name, dist: haversineMeters(rider.lat!, rider.lng!, a.lat!, a.lng!) }))
      .sort((a, b) => a.dist - b.dist)
    nearestArea = sorted[0]?.name ?? null
  }

  return (
    <RiderJobsClient
      riderId={user.id}
      firstName={firstName}
      todayAmount={todayAmount}
      todayTrips={todayTrips}
      initialAvailable={rider?.is_available ?? false}
      locationUpdatedAt={rider?.location_updated_at ?? null}
      nearestArea={nearestArea}
      initialJobs={(activeOrders ?? []) as any[]}
    />
  )
}
