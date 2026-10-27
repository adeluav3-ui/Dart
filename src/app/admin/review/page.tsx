import { createAdminClient } from '@/lib/supabase/admin'
import { ReviewQueueClient } from './ReviewQueueClient'

export default async function AdminReviewPage() {
  const admin = createAdminClient()

  // Items in review + live items with pending changes
  const { data: rawItems } = await admin
    .from('menu_items')
    .select(`
      *,
      menu_categories(name),
      vendors(name)
    `)
    .or('status.eq.in_review,pending_price.not.is.null,pending_photo_url.not.is.null')
    .order('created_at', { ascending: true })

  const items = (rawItems ?? []).map((i: {
    id: string
    vendor_id: string
    category_id: string | null
    name: string
    description: string | null
    photo_url: string | null
    base_price: number
    pack_size: string | null
    stock_qty: number | null
    is_available: boolean
    sort_order: number
    status: string
    review_note: string | null
    is_sold_out: boolean
    pending_price: number | null
    pending_photo_url: string | null
    menu_categories: { name: string } | null
    vendors: { name: string } | null
  }) => ({
    ...i,
    vendor_name: i.vendors?.name ?? 'Unknown vendor',
    category_name: i.menu_categories?.name ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any)

  return <ReviewQueueClient initialItems={items} />
}
