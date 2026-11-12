import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ShopClient } from './ShopClient'

export default async function VendorShopPage() {
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

  const [{ data: hours }, { data: areas }, { data: pushSub }] = await Promise.all([
    admin
      .from('vendor_hours')
      .select('*')
      .eq('vendor_id', vendor.id)
      .order('day_of_week'),
    admin
      .from('areas')
      .select('*')
      .or('status.eq.active,is_active.eq.true')
      .order('sort_order'),
    admin
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', user!.id)
      .limit(1),
  ])

  return (
    <ShopClient
      vendor={vendor}
      initialHours={hours ?? []}
      areas={areas ?? []}
      hasPushSub={(pushSub?.length ?? 0) > 0}
    />
  )
}
