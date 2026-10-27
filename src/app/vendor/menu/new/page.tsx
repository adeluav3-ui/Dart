import { createClient } from '@/lib/supabase/server'
import { ItemFormClient } from '../ItemFormClient'

export default async function NewItemPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: vendor } = await supabase
    .from('vendors')
    .select('*')
    .eq('owner_id', user!.id)
    .single()

  if (!vendor) return <p className="p-6 text-ink-2">No vendor account found.</p>

  const { data: categories } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('vendor_id', vendor.id)
    .order('sort_order')

  return (
    <ItemFormClient
      vendor={vendor}
      categories={categories ?? []}
    />
  )
}
