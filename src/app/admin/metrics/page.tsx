import { createClient } from '@/lib/supabase/server'
import { formatMoney } from '@/lib/format'

export default async function AdminMetricsPage() {
  const supabase = createClient()

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const fourteenDaysAgo = new Date(today)
  fourteenDaysAgo.setDate(today.getDate() - 14)

  const [{ data: todayDelivered }, { data: allDelivered }, { data: refunds }, { data: cancelled }, { data: todayOrders }] =
    await Promise.all([
      supabase.from('orders').select('total, subtotal, delivery_fee, service_fee, commission_amount')
        .eq('status', 'delivered').gte('delivered_at', today.toISOString()),
      supabase.from('orders').select('customer_id, delivered_at, subtotal, commission_amount, service_fee, delivery_fee')
        .eq('status', 'delivered').gte('delivered_at', fourteenDaysAgo.toISOString()),
      supabase.from('orders').select('id').in('status', ['cancelled']).gte('created_at', today.toISOString()),
      supabase.from('orders').select('id').in('status', ['cancelled', 'expired']).gte('created_at', today.toISOString()),
      supabase.from('orders').select('pickup_distance_m')
        .eq('status', 'delivered')
        .not('pickup_distance_m', 'is', null)
        .gte('delivered_at', today.toISOString()),
    ])

  const todayOrderCount = todayDelivered?.length ?? 0
  const todayRevenue = (todayDelivered ?? []).reduce((s: number, o: { total: number }) => s + o.total, 0)
  const todayMargin = (todayDelivered ?? []).reduce((s: number, o: { commission_amount: number; service_fee: number }) =>
    s + o.commission_amount + o.service_fee, 0)

  // 14-day reorder rate: customers who ordered more than once
  const customerOrders: Record<string, number> = {}
  for (const o of allDelivered ?? []) {
    customerOrders[o.customer_id] = (customerOrders[o.customer_id] ?? 0) + 1
  }
  const totalCustomers = Object.keys(customerOrders).length
  const repeatCustomers = Object.values(customerOrders).filter(n => n > 1).length
  const reorderRate = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0

  // Average pickup distance today
  const pickupDistances = (todayOrders ?? []).map(o => o.pickup_distance_m as number)
  const avgPickupM = pickupDistances.length > 0
    ? Math.round(pickupDistances.reduce((s, d) => s + d, 0) / pickupDistances.length)
    : null

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-heading font-bold text-xl">Metrics</h2>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Orders today" value={String(todayOrderCount)} />
        <Stat label="Revenue today" value={formatMoney(todayRevenue)} />
        <Stat label="Platform margin today" value={formatMoney(todayMargin)} />
        <Stat label="14-day reorder rate" value={`${reorderRate}%`} />
        <Stat label="Refunds today" value={String(refunds?.length ?? 0)} />
        <Stat label="Cancelled/expired today" value={String(cancelled?.length ?? 0)} />
        <Stat
          label="Avg rider pickup distance"
          value={avgPickupM != null ? (avgPickupM >= 1000 ? `${(avgPickupM / 1000).toFixed(1)} km` : `${avgPickupM} m`) : '—'}
          sub={pickupDistances.length > 0 ? `${pickupDistances.length} order${pickupDistances.length !== 1 ? 's' : ''} today` : 'No data yet'}
        />
      </div>

      <div className="bg-brand-tint rounded-2xl p-4 text-sm text-brand-ink">
        <b>Pilot gate:</b> aim for 30–50 orders/day over 4 weeks, positive margin on every order, and a healthy reorder rate before moving to v2.
      </div>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 flex flex-col gap-1">
      <span className="text-xs font-semibold text-ink-2">{label}</span>
      <span className="font-heading font-extrabold text-2xl">{value}</span>
      {sub && <span className="text-[11px] text-ink-2">{sub}</span>}
    </div>
  )
}
