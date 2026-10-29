import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminLiveBoardClient } from './AdminLiveBoardClient'
import { STALE_MS } from '@/lib/geo'

export default async function AdminLivePage() {
  const supabase = createClient()
  const admin = createAdminClient()

  const staleThreshold = new Date(Date.now() - STALE_MS).toISOString()

  const [{ data: orders }, { data: rawRiders }, { data: areas }, { count: unpinnedCount }] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        *,
        vendors (name),
        profiles!orders_customer_id_fkey (phone),
        profiles!orders_rider_id_fkey (full_name)
      `)
      .not('status', 'in', '("delivered","cancelled","expired")')
      .order('created_at', { ascending: true }),
    admin
      .from('riders')
      .select('id, is_available, lat, lng, location_updated_at, profiles(full_name)')
      .eq('is_available', true)
      .gte('location_updated_at', staleThreshold),
    admin.from('areas').select('id, name, lat, lng').eq('status', 'active').not('lat', 'is', null),
    admin.from('areas').select('*', { count: 'exact', head: true }).is('lat', null),
  ])

  // Compute nearest area for each available rider
  const { haversineMeters } = await import('@/lib/geo')

  type RiderRow = {
    id: string
    is_available: boolean
    lat: number | null
    lng: number | null
    location_updated_at: string | null
    profiles: { full_name: string | null } | { full_name: string | null }[] | null
  }

  const availableRiders = (rawRiders as unknown as RiderRow[] ?? []).map(r => {
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    let nearestArea = ''
    if (r.lat != null && r.lng != null && areas) {
      let minDist = Infinity
      for (const a of areas) {
        if (a.lat == null || a.lng == null) continue
        const d = haversineMeters(r.lat, r.lng, a.lat, a.lng)
        if (d < minDist) { minDist = d; nearestArea = a.name }
      }
    }
    return {
      id: r.id,
      name: profile?.full_name ?? 'Rider',
      nearestArea,
      locationUpdatedAt: r.location_updated_at,
    }
  })

  // All riders for the legacy admin assign dropdown
  const { data: allRiders } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .eq('role', 'rider')

  return (
    <>
      {(unpinnedCount ?? 0) > 0 && (
        <Link
          href="/admin/areas/pins"
          className="flex items-center justify-between mb-4 px-4 py-3 rounded-2xl bg-warn-tint border border-warn/20 no-underline"
        >
          <span className="text-sm font-semibold text-warn">
            {unpinnedCount} {unpinnedCount === 1 ? 'area has' : 'areas have'} no GPS pin — &quot;Use my location&quot; won&apos;t work for them
          </span>
          <span className="text-sm font-bold text-warn shrink-0 ml-3">Set pins →</span>
        </Link>
      )}
      <AdminLiveBoardClient
        initialOrders={orders ?? []}
        riders={allRiders ?? []}
        availableRiders={availableRiders}
      />
    </>
  )
}
