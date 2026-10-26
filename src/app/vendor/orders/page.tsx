import { createClient } from '@/lib/supabase/server'
import { VendorBoardClient } from './VendorBoardClient'

export default async function VendorOrdersPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: vendor } = await supabase
    .from('vendors')
    .select('*')
    .eq('owner_id', user!.id)
    .single()

  if (!vendor) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-ink-2">No vendor account found. Contact admin.</p>
      </div>
    )
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('vendor_id', vendor.id)
    .in('status', ['paid', 'accepted', 'ready'])
    .order('created_at', { ascending: true })

  return <VendorBoardClient vendor={vendor} initialOrders={orders ?? []} />
}
