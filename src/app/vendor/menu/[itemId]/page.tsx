import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { ItemFormClient } from '../ItemFormClient'

interface Props {
  params: { itemId: string }
}

export default async function EditItemPage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: vendor } = await supabase
    .from('vendors')
    .select('*')
    .eq('owner_id', user!.id)
    .single()

  if (!vendor) return <p className="p-6 text-ink-2">No vendor account found.</p>

  const admin = createAdminClient()

  const [{ data: item }, { data: categories }, { data: optionGroups }] = await Promise.all([
    admin
      .from('menu_items')
      .select('*')
      .eq('id', params.itemId)
      .eq('vendor_id', vendor.id)
      .single(),
    supabase
      .from('menu_categories')
      .select('*')
      .eq('vendor_id', vendor.id)
      .order('sort_order'),
    admin
      .from('option_groups')
      .select('*, options(*)')
      .eq('item_id', params.itemId)
      .order('sort_order'),
  ])

  if (!item) notFound()

  const initialOptionGroups = (optionGroups ?? []).map((g: {
    id: string; name: string; min_select: number; max_select: number
    options: { name: string; price_delta: number }[]
  }) => ({
    id: g.id,
    name: g.name,
    min_select: g.min_select,
    max_select: g.max_select,
    options: (g.options ?? []).map((o: { name: string; price_delta: number }) => ({
      name: o.name,
      price_delta: o.price_delta,
    })),
  }))

  return (
    <ItemFormClient
      vendor={vendor}
      categories={categories ?? []}
      item={item}
      initialOptionGroups={initialOptionGroups}
    />
  )
}
