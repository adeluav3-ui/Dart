import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminLiveBoardClient } from './AdminLiveBoardClient'
import { formatMoney, formatDate } from '@/lib/format'
import { STALE_MS } from '@/lib/geo'

export const dynamic = 'force-dynamic'

export default async function AdminOverviewPage() {
  const supabase = createClient()
  const admin = createAdminClient()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()
  const staleThreshold = new Date(Date.now() - STALE_MS).toISOString()

  const [
    { count: liveCount },
    { count: deliveredTotalCount },
    { count: deliveredTodayCount },
    { count: customerCount },
    { count: vendorCount },
    { count: riderCount },
    { count: pendingAppsCount },
    { count: openTicketsCount },
    { count: activeAreasCount },
    { count: comingSoonCount },
    { count: unpinnedCount },
    { data: allPlatformEarnings },
    { data: todayPlatformEarnings },
    { data: unsettledEntries },
    { data: liveOrders },
    { data: rawRiders },
    { data: areaList },
    { data: recentDelivered },
    { data: allRiders },
  ] = await Promise.all([
    admin.from('orders').select('*', { count: 'exact', head: true })
      .not('status', 'in', '("delivered","cancelled","expired")'),
    admin.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'delivered'),
    admin.from('orders').select('*', { count: 'exact', head: true })
      .eq('status', 'delivered').gte('delivered_at', todayISO),
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
    admin.from('vendors').select('*', { count: 'exact', head: true }).eq('is_verified', true).eq('is_active', true),
    admin.from('riders').select('*', { count: 'exact', head: true }).eq('is_active', true),
    admin.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
    admin.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    admin.from('areas').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('areas').select('*', { count: 'exact', head: true }).eq('status', 'coming_soon'),
    admin.from('areas').select('*', { count: 'exact', head: true }).is('lat', null).eq('status', 'active'),
    admin.from('ledger_entries').select('amount').eq('party_type', 'platform'),
    admin.from('ledger_entries').select('amount').eq('party_type', 'platform').gte('created_at', todayISO),
    admin.from('ledger_entries').select('amount, party_type')
      .not('party_type', 'eq', 'platform').is('settled_at', null).is('payout_ref', null),
    supabase
      .from('orders')
      .select('*, vendors(name), profiles!orders_customer_id_fkey(phone), profiles!orders_rider_id_fkey(full_name)')
      .not('status', 'in', '("delivered","cancelled","expired")')
      .order('created_at', { ascending: true }),
    admin
      .from('riders')
      .select('id, is_available, lat, lng, location_updated_at, profiles(full_name)')
      .eq('is_available', true)
      .gte('location_updated_at', staleThreshold),
    admin.from('areas').select('id, name, lat, lng').eq('status', 'active').not('lat', 'is', null),
    admin
      .from('orders')
      .select('id, code, total, delivered_at, vendors(name), profiles!orders_customer_id_fkey(full_name)')
      .eq('status', 'delivered')
      .order('delivered_at', { ascending: false })
      .limit(10),
    supabase.from('profiles').select('id, full_name, phone').eq('role', 'rider'),
  ])

  const totalRevenue = (allPlatformEarnings ?? []).reduce(
    (s: number, e: { amount: number }) => s + e.amount, 0
  )
  const todayRevenue = (todayPlatformEarnings ?? []).reduce(
    (s: number, e: { amount: number }) => s + e.amount, 0
  )
  const vendorWallet = (unsettledEntries ?? [])
    .filter((e: { party_type: string }) => e.party_type === 'vendor')
    .reduce((s: number, e: { amount: number }) => s + e.amount, 0)
  const riderWallet = (unsettledEntries ?? [])
    .filter((e: { party_type: string }) => e.party_type === 'rider')
    .reduce((s: number, e: { amount: number }) => s + e.amount, 0)

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
    if (r.lat != null && r.lng != null && areaList) {
      let minDist = Infinity
      for (const a of areaList) {
        if (a.lat == null || a.lng == null) continue
        const d = haversineMeters(r.lat, r.lng, a.lat, a.lng)
        if (d < minDist) { minDist = d; nearestArea = a.name }
      }
    }
    return { id: r.id, name: profile?.full_name ?? 'Rider', nearestArea, locationUpdatedAt: r.location_updated_at }
  })

  type RecentOrder = {
    id: string
    code: string
    total: number
    delivered_at: string | null
    vendors: { name: string } | null
    profiles: { full_name: string | null } | null
  }

  return (
    <div className="p-4 lg:p-6 flex flex-col gap-6">
      <h2 className="font-heading font-bold text-2xl text-ink">Overview</h2>

      {/* Attention banners */}
      {((pendingAppsCount ?? 0) > 0 || (openTicketsCount ?? 0) > 0 || (unpinnedCount ?? 0) > 0) && (
        <div className="flex flex-col gap-2">
          {(pendingAppsCount ?? 0) > 0 && (
            <Link
              href="/admin/applications"
              className="flex items-center justify-between px-4 py-3 rounded-2xl bg-warn-tint border border-warn/20 no-underline"
            >
              <span className="text-sm font-semibold text-warn">
                {pendingAppsCount} pending application{pendingAppsCount !== 1 ? 's' : ''} need review
              </span>
              <span className="text-sm font-bold text-warn shrink-0 ml-3">Review →</span>
            </Link>
          )}
          {(openTicketsCount ?? 0) > 0 && (
            <Link
              href="/admin/support"
              className="flex items-center justify-between px-4 py-3 rounded-2xl bg-warn-tint border border-warn/20 no-underline"
            >
              <span className="text-sm font-semibold text-warn">
                {openTicketsCount} open support ticket{openTicketsCount !== 1 ? 's' : ''}
              </span>
              <span className="text-sm font-bold text-warn shrink-0 ml-3">View →</span>
            </Link>
          )}
          {(unpinnedCount ?? 0) > 0 && (
            <Link
              href="/admin/areas/pins"
              className="flex items-center justify-between px-4 py-3 rounded-2xl bg-warn-tint border border-warn/20 no-underline"
            >
              <span className="text-sm font-semibold text-warn">
                {unpinnedCount} active area{unpinnedCount !== 1 ? 's have' : ' has'} no GPS pin
              </span>
              <span className="text-sm font-bold text-warn shrink-0 ml-3">Set pins →</span>
            </Link>
          )}
        </div>
      )}

      {/* Revenue */}
      <section>
        <SectionLabel>Revenue</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="All-time earnings" value={formatMoney(totalRevenue)} />
          <StatCard label="Earned today" value={formatMoney(todayRevenue)} accent />
        </div>
      </section>

      {/* Orders */}
      <section>
        <SectionLabel>Orders</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Live now" value={liveCount ?? 0} />
          <StatCard label="Delivered today" value={deliveredTodayCount ?? 0} />
          <StatCard label="All-time delivered" value={(deliveredTotalCount ?? 0).toLocaleString('en-NG')} />
        </div>
      </section>

      {/* Platform people */}
      <section>
        <SectionLabel>Platform</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Customers" value={(customerCount ?? 0).toLocaleString('en-NG')} href="/admin/users" />
          <StatCard label="Active vendors" value={vendorCount ?? 0} href="/admin/vendors" />
          <StatCard label="Active riders" value={riderCount ?? 0} href="/admin/riders" />
        </div>
      </section>

      {/* Wallets + Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
          <SectionLabel>Wallets (not yet withdrawn)</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-canvas rounded-xl p-3">
              <p className="text-[11px] text-ink-2 font-medium mb-1">Vendor wallets</p>
              <p className="font-heading font-extrabold text-xl text-ink">{formatMoney(vendorWallet)}</p>
            </div>
            <div className="bg-canvas rounded-xl p-3">
              <p className="text-[11px] text-ink-2 font-medium mb-1">Rider wallets</p>
              <p className="font-heading font-extrabold text-xl text-ink">{formatMoney(riderWallet)}</p>
            </div>
          </div>
          <p className="text-[11px] text-ink-2 leading-relaxed">
            Earned but not yet withdrawn. Vendors and riders pull this directly to their bank — no action needed from GoCart.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
          <SectionLabel>Areas</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/admin/areas" className="bg-canvas rounded-xl p-3 no-underline block">
              <p className="text-[11px] text-ink-2 font-medium mb-1">Operational</p>
              <p className="font-heading font-extrabold text-xl text-brand">{activeAreasCount ?? 0}</p>
            </Link>
            <div className="bg-canvas rounded-xl p-3">
              <p className="text-[11px] text-ink-2 font-medium mb-1">Coming soon</p>
              <p className="font-heading font-extrabold text-xl text-ink">{comingSoonCount ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Live orders */}
      <section>
        <SectionLabel>Live orders</SectionLabel>
        <AdminLiveBoardClient
          initialOrders={liveOrders ?? []}
          riders={allRiders ?? []}
          availableRiders={availableRiders}
        />
      </section>

      {/* Recent completed orders */}
      <section>
        <SectionLabel>Recent completed orders</SectionLabel>
        {(recentDelivered ?? []).length === 0 ? (
          <p className="text-sm text-ink-2">No completed orders yet.</p>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden">
            {(recentDelivered as unknown as RecentOrder[]).map((order, i) => (
              <div
                key={order.id}
                className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}
              >
                <div>
                  <p className="text-[13px] font-bold text-ink">{order.code}</p>
                  <p className="text-[12px] text-ink-2">
                    {order.vendors?.name ?? '—'} · {order.profiles?.full_name ?? 'Customer'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-bold text-brand">{formatMoney(order.total)}</p>
                  {order.delivered_at && (
                    <p className="text-[11px] text-ink-2">{formatDate(order.delivered_at)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold text-ink-2 uppercase tracking-widest mb-2">{children}</h3>
  )
}

function StatCard({
  label,
  value,
  accent,
  href,
}: {
  label: string
  value: string | number
  accent?: boolean
  href?: string
}) {
  const inner = (
    <div className={`rounded-2xl p-4 flex flex-col gap-1 h-full ${accent ? 'bg-brand-tint' : 'bg-white'}`}>
      <span className="text-[11px] font-medium text-ink-2">{label}</span>
      <span className={`font-heading font-extrabold text-2xl leading-none mt-1 ${accent ? 'text-brand-ink' : 'text-ink'}`}>
        {value}
      </span>
    </div>
  )
  if (href) return <Link href={href} className="no-underline">{inner}</Link>
  return inner
}
