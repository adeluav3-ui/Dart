import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { VendorPageClient } from './VendorPageClient'
import type { Vendor, MenuCategory, MenuItem, OptionGroup, Option } from '@/types/database'

export const revalidate = 30

export default async function VendorPage({ params }: { params: { slug: string } }) {
  const supabase = createClient()

  const { data: raw } = await supabase
    .from('vendors')
    .select(`
      *,
      menu_categories(id, name, vendor_id, sort_order),
      menu_items(
        *,
        option_groups(
          id, item_id, name, min_select, max_select, sort_order,
          options(id, group_id, name, price_delta, is_available, sort_order)
        )
      )
    `)
    .eq('slug', params.slug)
    .single()

  if (!raw) notFound()

  // Flatten nested data into the flat arrays VendorPageClient expects
  const vendor = raw as unknown as Vendor
  const categories = ((raw as any).menu_categories ?? [] as MenuCategory[])
    .sort((a: MenuCategory, b: MenuCategory) => a.sort_order - b.sort_order) as MenuCategory[]
  const rawItems: any[] = ((raw as any).menu_items ?? [])
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
  const items = rawItems.map(({ option_groups: _og, ...item }) => item) as MenuItem[]
  const optionGroups = rawItems
    .flatMap(i => (i.option_groups ?? []).map(({ options: _o, ...g }: any) => g))
    .sort((a: any, b: any) => a.sort_order - b.sort_order) as OptionGroup[]
  const options = rawItems
    .flatMap(i => (i.option_groups ?? []).flatMap((g: any) => g.options ?? []))
    .sort((a: any, b: any) => a.sort_order - b.sort_order) as Option[]

  return (
    <VendorPageClient
      vendor={vendor}
      categories={categories}
      items={items}
      optionGroups={optionGroups}
      options={options}
    />
  )
}
