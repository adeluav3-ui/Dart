import { createClient } from '@/lib/supabase/server'
import { AdminLiveBoardClient } from './AdminLiveBoardClient'

export default async function AdminLivePage() {
  const supabase = createClient()

  const { data: orders } = await supabase
    .from('orders')
    .select(`
      *,
      vendors (name),
      profiles!orders_customer_id_fkey (phone),
      profiles!orders_rider_id_fkey (full_name)
    `)
    .not('status', 'in', '("delivered","cancelled","expired")')
    .order('created_at', { ascending: true })

  const { data: riders } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .eq('role', 'rider')

  return <AdminLiveBoardClient initialOrders={orders ?? []} riders={riders ?? []} />
}
