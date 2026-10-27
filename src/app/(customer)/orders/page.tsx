import { createClient } from '@/lib/supabase/server'
import { OrdersClient } from './OrdersClient'
import Link from 'next/link'
import type { Order, OrderItem, Review } from '@/types/database'

export const dynamic = 'force-dynamic'

type OrderWithExtras = Order & {
  vendors: { name: string; cover_photo_url: string | null; slug: string } | null
  order_items: Pick<OrderItem, 'id' | 'name_snapshot' | 'qty'>[]
  reviews: Pick<Review, 'id' | 'rating'>[]
}

export default async function OrdersPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="min-h-dvh bg-canvas flex flex-col font-body"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>
        <header className="bg-white px-5 pt-5 pb-4">
          <h1 className="font-heading font-extrabold text-[26px] text-ink">Orders</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 pb-8">
          <div className="w-20 h-20 rounded-full bg-brand-tint flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0B7A47" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 4h10a1 1 0 0 1 1 1v15l-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1z" />
              <path d="M9 9h6M9 13h4" />
            </svg>
          </div>
          <div className="text-center flex flex-col gap-1.5">
            <p className="font-heading font-bold text-[18px] text-ink">Sign in to see your orders</p>
            <p className="text-[14px] text-ink-2">Track your deliveries and reorder favourites.</p>
          </div>
          <Link
            href="/login?next=/orders"
            className="h-[52px] w-full max-w-xs rounded-2xl bg-brand text-white font-body font-bold text-[16px] flex items-center justify-center no-underline"
          >
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  const [{ data: activeOrders }, { data: pastOrders }] = await Promise.all([
    supabase
      .from('orders')
      .select('*, vendors(name, cover_photo_url, slug), order_items(id, name_snapshot, qty), reviews(id, rating)')
      .eq('customer_id', user.id)
      .not('status', 'in', '(delivered,cancelled,expired)')
      .order('created_at', { ascending: false }),
    supabase
      .from('orders')
      .select('*, vendors(name, cover_photo_url, slug), order_items(id, name_snapshot, qty), reviews(id, rating)')
      .eq('customer_id', user.id)
      .in('status', ['delivered', 'cancelled', 'expired'])
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return (
    <OrdersClient
      userId={user.id}
      initialActive={(activeOrders as OrderWithExtras[]) ?? []}
      initialPast={(pastOrders as OrderWithExtras[]) ?? []}
    />
  )
}
