import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { VendorBoardClient } from './VendorBoardClient'
import type { SetupStep } from './VendorBoardClient'

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

  const admin = createAdminClient()

  const [{ data: orders }, { data: items }, { data: hours }, { data: pushSub }] =
    await Promise.all([
      supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('vendor_id', vendor.id)
        .in('status', ['paid', 'accepted', 'ready'])
        .order('created_at', { ascending: true }),

      // Items with price + photo (live-ready items)
      admin
        .from('menu_items')
        .select('id, base_price, photo_url, status')
        .eq('vendor_id', vendor.id),

      admin
        .from('vendor_hours')
        .select('id')
        .eq('vendor_id', vendor.id)
        .limit(1),

      admin
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', user!.id)
        .limit(1),
    ])

  const liveReadyItems = (items ?? []).filter(
    (i: { base_price: number; photo_url: string | null }) =>
      i.base_price > 0 && i.photo_url != null
  )

  const setupSteps: SetupStep[] = vendor.is_verified
    ? []
    : [
        {
          key: 'details',
          label: 'Add shop name, area and opening hours',
          done: !!(vendor.area_id && (hours?.length ?? 0) > 0),
          href: '/vendor/shop',
        },
        {
          key: 'cover',
          label: 'Upload a cover photo',
          done: !!vendor.cover_photo_url,
          href: '/vendor/shop',
        },
        {
          key: 'items',
          label: 'Add at least 5 items with price and photo',
          done: liveReadyItems.length >= 5,
          href: '/vendor/menu',
        },
        {
          key: 'payout',
          label: 'Add your payout bank account',
          done: !!vendor.payout_account_no,
          href: '/vendor/shop',
        },
        {
          key: 'alerts',
          label: 'Enable order alerts',
          done: (pushSub?.length ?? 0) > 0,
          href: '/vendor/shop',
        },
      ]

  return (
    <VendorBoardClient
      vendor={vendor}
      initialOrders={orders ?? []}
      setupSteps={setupSteps}
    />
  )
}
