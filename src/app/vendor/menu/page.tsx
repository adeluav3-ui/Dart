import { createClient } from '@/lib/supabase/server'
import { MenuManagerClient } from './MenuManagerClient'

export default async function VendorMenuPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: vendor } = await supabase
    .from('vendors')
    .select('*')
    .eq('owner_id', user!.id)
    .single()

  if (!vendor) return <p className="p-6 text-ink-2">No vendor account found.</p>

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase
      .from('menu_categories')
      .select('*')
      .eq('vendor_id', vendor.id)
      .order('sort_order'),
    supabase
      .from('menu_items')
      .select('*')
      .eq('vendor_id', vendor.id)
      .order('sort_order'),
  ])

  return (
    <MenuManagerClient
      vendor={vendor}
      initialCategories={categories ?? []}
      initialItems={items ?? []}
    />
  )
}
