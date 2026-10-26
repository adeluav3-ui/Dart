import { createClient } from '@/lib/supabase/server'
import { RiderJobsClient } from './RiderJobsClient'

export default async function RiderJobsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: orders } = await supabase
    .from('orders')
    .select(`
      *,
      vendors (name, id),
      order_items (name_snapshot, qty)
    `)
    .eq('rider_id', user!.id)
    .in('status', ['ready', 'picked_up'])
    .order('ready_at', { ascending: true })

  return <RiderJobsClient initialJobs={orders ?? []} riderId={user!.id} />
}
