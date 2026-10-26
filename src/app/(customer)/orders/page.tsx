import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatMoney, formatDate } from '@/lib/format'
import type { Order, OrderStatus } from '@/types/database'

const STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  pending_payment: 'Awaiting payment',
  paid: 'Paid',
  accepted: 'Preparing',
  ready: 'Ready',
  picked_up: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  expired: 'Expired',
}

export default async function OrdersPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/orders')

  const { data: orders } = await supabase
    .from('orders')
    .select('*, vendors(name)')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const active = (orders ?? []).filter((o: Order & { vendors: { name: string } }) =>
    !['delivered', 'cancelled', 'expired'].includes(o.status)
  )
  const past = (orders ?? []).filter((o: Order & { vendors: { name: string } }) =>
    ['delivered', 'cancelled', 'expired'].includes(o.status)
  )

  return (
    <div className="min-h-screen bg-canvas font-body text-ink">
      <header className="bg-white px-5 pt-5 pb-3 border-b border-line">
        <h1 className="font-heading font-extrabold text-2xl">My orders</h1>
      </header>

      <div className="px-4 py-4 flex flex-col gap-3">
        {active.length > 0 && (
          <>
            <h2 className="text-[13px] font-bold text-ink-2 uppercase tracking-wide">Active</h2>
            {active.map((o: Order & { vendors: { name: string } }) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </>
        )}

        {past.length > 0 && (
          <>
            <h2 className="text-[13px] font-bold text-ink-2 uppercase tracking-wide mt-2">Past orders</h2>
            {past.map((o: Order & { vendors: { name: string } }) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </>
        )}

        {orders?.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-20">
            <p className="text-ink-2">No orders yet</p>
            <Link href="/" className="text-brand font-semibold">Order something now</Link>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 h-[76px] px-3 pb-4 pt-2 bg-white border-t border-line grid grid-cols-4">
        <Link href="/" className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-ink-2 no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>
          Home
        </Link>
        <Link href="/orders" className="flex flex-col items-center justify-center gap-1 text-xs font-bold text-brand no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 4h10a1 1 0 0 1 1 1v15l-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1z"/><path d="M9 9h6M9 13h4"/></svg>
          Orders
        </Link>
        <Link href="/wallet" className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-ink-2 no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12.5h2M3 10h18"/></svg>
          Wallet
        </Link>
        <Link href="/account" className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-ink-2 no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>
          Account
        </Link>
      </nav>
    </div>
  )
}

function OrderCard({ order }: { order: Order & { vendors: { name: string } } }) {
  const isActive = !['delivered', 'cancelled', 'expired'].includes(order.status)
  const statusLabel = STATUS_LABELS[order.status] ?? order.status

  return (
    <Link
      href={`/track/${order.id}`}
      className="bg-white rounded-2xl p-4 flex flex-col gap-2 no-underline text-ink"
    >
      <div className="flex justify-between items-start">
        <span className="text-base font-bold">{order.vendors?.name}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          order.status === 'delivered' ? 'bg-brand-tint text-brand-ink' :
          order.status === 'cancelled' || order.status === 'expired' ? 'bg-danger/10 text-danger' :
          'bg-warn-tint text-warn'
        }`}>
          {statusLabel}
        </span>
      </div>
      <div className="flex justify-between text-sm text-ink-2">
        <span>{order.code}</span>
        <span>{formatDate(order.created_at)}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[15px] font-bold">{formatMoney(order.total)}</span>
        {order.status === 'delivered' && (
          <ReorderButton orderId={order.id} />
        )}
      </div>
    </Link>
  )
}

function ReorderButton({ orderId }: { orderId: string }) {
  return (
    <form action={`/api/orders/${orderId}/reorder`} method="POST">
      <button
        type="submit"
        className="h-9 px-4 rounded-xl bg-brand-tint text-brand-ink text-sm font-bold"
        onClick={e => e.stopPropagation()}
      >
        Reorder
      </button>
    </form>
  )
}
