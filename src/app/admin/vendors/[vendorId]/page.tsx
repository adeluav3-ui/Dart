import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { VendorDetailClient } from './VendorDetailClient'

export const dynamic = 'force-dynamic'

export default async function AdminVendorDetailPage({ params }: { params: { vendorId: string } }) {
  const supabase = createClient()

  const [{ data: vendor }, { data: categories }, { data: items }, { data: groups }, { data: options }] =
    await Promise.all([
      supabase.from('vendors').select('*').eq('id', params.vendorId).single(),
      supabase.from('menu_categories').select('*').eq('vendor_id', params.vendorId).order('sort_order'),
      supabase.from('menu_items').select('*').eq('vendor_id', params.vendorId).order('sort_order'),
      supabase.from('option_groups').select('*'),
      supabase.from('options').select('*').order('sort_order'),
    ])

  if (!vendor) notFound()

  const itemIds = (items ?? []).map((i: { id: string }) => i.id)
  const vendorGroups = (groups ?? []).filter((g: { item_id: string }) => itemIds.includes(g.item_id))
  const groupIds = vendorGroups.map((g: { id: string }) => g.id)
  const vendorOptions = (options ?? []).filter((o: { group_id: string }) => groupIds.includes(o.group_id))

  return (
    <VendorDetailClient
      vendor={vendor}
      categories={categories ?? []}
      items={items ?? []}
      optionGroups={vendorGroups}
      options={vendorOptions}
    />
  )
}
