import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { RiderJobsClient } from './RiderJobsClient'

export default async function RiderJobsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()

  const [{ data: orders }, { data: rider }] = await Promise.all([
    supabase
      .from('orders')
      .select('*, vendors (name, id), order_items (name_snapshot, qty)')
      .eq('rider_id', user!.id)
      .in('status', ['ready', 'picked_up'])
      .order('ready_at', { ascending: true }),
    admin
      .from('riders')
      .select('is_available, location_updated_at')
      .eq('id', user!.id)
      .single(),
  ])

  return (
    <RiderJobsClient
      initialJobs={orders ?? []}
      riderId={user!.id}
      initialAvailable={rider?.is_available ?? false}
      locationUpdatedAt={rider?.location_updated_at ?? null}
    />
  )
}
