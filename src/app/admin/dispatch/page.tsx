import { createClient } from '@/lib/supabase/server'
import { DispatchClient } from './DispatchClient'

export const dynamic = 'force-dynamic'

export default async function DispatchPage() {
  const supabase = createClient()

  const [{ data: orders }, { data: riders }] = await Promise.all([
    supabase
      .from('orders')
      .select('*, vendors(name), order_items(name_snapshot, qty)')
      .in('status', ['accepted', 'ready'])
      .order('accepted_at', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('role', 'rider'),
  ])

  // Count active jobs per rider
  const { data: activeCounts } = await supabase
    .from('orders')
    .select('rider_id')
    .in('status', ['ready', 'picked_up'])

  const riderLoad: Record<string, number> = {}
  ;(activeCounts ?? []).forEach((o: { rider_id: string | null }) => {
    if (o.rider_id) riderLoad[o.rider_id] = (riderLoad[o.rider_id] ?? 0) + 1
  })

  return (
    <DispatchClient
      initialOrders={orders ?? []}
      riders={(riders ?? []).map(r => ({ ...r, activeJobs: riderLoad[r.id] ?? 0 }))}
    />
  )
}
