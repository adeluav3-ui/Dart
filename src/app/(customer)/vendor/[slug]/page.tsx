import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { VendorPageClient } from './VendorPageClient'
import type { Vendor, MenuCategory, MenuItem, OptionGroup, Option } from '@/types/database'

export default async function VendorPage({ params }: { params: { slug: string } }) {
  const supabase = createClient()

  const { data: vendor } = await supabase
    .from('vendors')
    .select('*')
    .eq('slug', params.slug)
    .single()

  if (!vendor) notFound()

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from('menu_categories').select('*').eq('vendor_id', vendor.id).order('sort_order'),
    supabase.from('menu_items').select('*').eq('vendor_id', vendor.id).order('sort_order'),
  ])

  const itemIds = (items ?? []).map((i: MenuItem) => i.id)

  const [{ data: groups }, { data: options }] = await Promise.all([
    itemIds.length > 0
      ? supabase.from('option_groups').select('*').in('item_id', itemIds).order('sort_order')
      : Promise.resolve({ data: [] }),
    itemIds.length > 0
      ? supabase.from('options').select('*').order('sort_order')
      : Promise.resolve({ data: [] }),
  ])

  const groupIds = (groups ?? []).map((g: OptionGroup) => g.id)
  const filteredOptions = (options ?? []).filter((o: Option) => groupIds.includes(o.group_id))

  return (
    <VendorPageClient
      vendor={vendor as Vendor}
      categories={(categories as MenuCategory[]) ?? []}
      items={(items as MenuItem[]) ?? []}
      optionGroups={(groups as OptionGroup[]) ?? []}
      options={filteredOptions as Option[]}
    />
  )
}
