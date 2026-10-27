'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatMoney, formatDate } from '@/lib/format'
import { Star } from 'lucide-react'
import type { Order, OrderItem, OrderStatus, Review } from '@/types/database'

type OrderWithExtras = Order & {
  vendors: { name: string; cover_photo_url: string | null; slug: string } | null
  order_items: Pick<OrderItem, 'id' | 'name_snapshot' | 'qty'>[]
  reviews: Pick<Review, 'id' | 'rating'>[]
}

interface Props {
  userId: string
  initialActive: OrderWithExtras[]
  initialPast: OrderWithExtras[]
}

const ACTIVE_STATUSES = new Set<OrderStatus>(['paid', 'accepted', 'ready', 'picked_up'])
const PROGRESS_STEPS: OrderStatus[] = ['paid', 'accepted', 'ready', 'picked_up', 'delivered']

function progressCount(status: OrderStatus): number {
  const idx = PROGRESS_STEPS.indexOf(status)
  return idx === -1 ? 0 : idx + 1
}

const STATUS_LINES: Partial<Record<OrderStatus, string>> = {
  paid: 'Order confirmed, notifying kitchen',
  accepted: 'Kitchen is preparing your order',
  ready: 'Order ready, waiting for rider',
  picked_up: 'Rider on the way to you',
  delivered: 'Delivered',
  cancelled: 'Order cancelled',
  expired: 'Order expired',
}

export function OrdersClient({ userId, initialActive, initialPast }: Props) {
  const [tab, setTab] = useState<'active' | 'past'>('active')
  const [active, setActive] = useState<OrderWithExtras[]>(initialActive)
  const [past] = useState<OrderWithExtras[]>(initialPast)
  const [reordering, setReordering] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Realtime: subscribe to order status changes for this user
  useEffect(() => {
    const channel = supabase
      .channel('customer-orders')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `customer_id=eq.${userId}` },
        payload => {
          const updated = payload.new as Order
          if (!ACTIVE_STATUSES.has(updated.status)) {
            // Order moved to terminal state — remove from active and reload page
            setActive(prev => prev.filter(o => o.id !== updated.id))
            router.refresh()
          } else {
            setActive(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, supabase, router])

  async function reorder(orderId: string) {
    setReordering(orderId)
    const res = await fetch(`/api/orders/${orderId}/reorder`, { method: 'POST' })
    setReordering(null)
    if (res.ok) router.push('/checkout')
    else {
      const json = await res.json().catch(() => ({}))
      alert(json.error ?? 'Some items may no longer be available.')
    }
  }

  const noOrders = active.length === 0 && past.length === 0

  return (
    <div className="min-h-dvh bg-canvas font-body text-ink"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>

      <header className="bg-white px-5 pt-5 pb-0">
        <h1 className="font-heading font-extrabold text-[26px] text-ink mb-3">Orders</h1>
        <div className="flex gap-6 border-b border-line">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`pb-2.5 text-[15px] font-semibold border-b-2 -mb-px transition-colors ${
              tab === 'active' ? 'border-brand text-ink' : 'border-transparent text-ink-2'
            }`}
          >
            Active{active.length > 0 ? ` · ${active.length}` : ''}
          </button>
          <button
            type="button"
            onClick={() => setTab('past')}
            className={`pb-2.5 text-[15px] font-semibold border-b-2 -mb-px transition-colors ${
              tab === 'past' ? 'border-brand text-ink' : 'border-transparent text-ink-2'
            }`}
          >
            Past
          </button>
        </div>
      </header>

      <div className="px-4 pt-4 flex flex-col gap-3">
        {/* ── Empty state ── */}
        {noOrders && (
          <div className="flex flex-col items-center gap-5 py-16 px-4">
            <div className="w-24 h-24 rounded-full bg-brand-tint flex items-center justify-center">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#0B7A47" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <circle cx="12" cy="13" r="3"/>
                <path d="M12 10v1M12 16v1"/>
              </svg>
            </div>
            <div className="text-center flex flex-col gap-1.5">
              <p className="font-heading font-bold text-[20px] text-ink">No orders yet</p>
              <p className="text-[14px] text-ink-2 leading-relaxed">
                When you order food, groceries or pharmacy items, you&apos;ll track them here.
              </p>
            </div>
            <Link
              href="/home"
              className="h-[52px] px-8 rounded-2xl bg-brand text-white font-bold text-[16px] flex items-center justify-center no-underline"
            >
              Find something nearby
            </Link>
          </div>
        )}

        {/* ── Active tab ── */}
        {tab === 'active' && !noOrders && (
          <>
            {active.length === 0 ? (
              <p className="text-[14px] text-ink-2 text-center py-6">Nothing on the way right now.</p>
            ) : (
              active.map(order => <ActiveOrderCard key={order.id} order={order} />)
            )}
          </>
        )}

        {/* ── Past tab ── */}
        {tab === 'past' && (
          <>
            {past.length === 0 ? (
              <p className="text-[14px] text-ink-2 text-center py-6">No past orders yet.</p>
            ) : (
              past.map(order => (
                <PastOrderCard
                  key={order.id}
                  order={order}
                  reordering={reordering === order.id}
                  onReorder={() => reorder(order.id)}
                />
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ActiveOrderCard({ order }: { order: OrderWithExtras }) {
  const filled = progressCount(order.status)
  const statusLine = STATUS_LINES[order.status] ?? 'Processing'
  const itemCount = order.order_items?.length ?? 0
  const showEta = order.status === 'accepted' && order.prep_mins

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      {/* Vendor photo */}
      <div className="h-16 bg-photo relative overflow-hidden">
        {order.vendors?.cover_photo_url && (
          <Image src={order.vendors.cover_photo_url} alt="" fill className="object-cover" />
        )}
      </div>

      <div className="p-4 flex flex-col gap-3">
        {/* Vendor + meta */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold text-[16px] text-ink">{order.vendors?.name}</p>
            <p className="text-[13px] text-ink-2 mt-0.5">
              {order.code} · {itemCount} {itemCount === 1 ? 'item' : 'items'} · {formatMoney(order.total)}
            </p>
          </div>
        </div>

        {/* Status line */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[14px] font-semibold text-brand">{statusLine}</p>
          {showEta && (
            <span className="text-[13px] text-ink-2 shrink-0">~{order.prep_mins} min</span>
          )}
        </div>

        {/* Progress bar — 5 segments */}
        <div className="flex gap-1">
          {PROGRESS_STEPS.map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                i < filled ? 'bg-brand' : 'bg-surface'
              }`}
            />
          ))}
        </div>

        {/* Delivery PIN */}
        <p className="text-[13px] text-ink-2">
          Your delivery PIN: <span className="font-bold text-ink tracking-widest">{order.delivery_pin}</span>
        </p>

        {/* Track button */}
        <Link
          href={`/track/${order.id}`}
          className="h-11 rounded-2xl bg-brand text-white font-bold text-[15px] flex items-center justify-center no-underline"
        >
          Track order
        </Link>
      </div>
    </div>
  )
}

function PastOrderCard({
  order,
  reordering,
  onReorder,
}: {
  order: OrderWithExtras
  reordering: boolean
  onReorder: () => void
}) {
  const items = order.order_items ?? []
  const preview = items.slice(0, 2).map(i => `${i.qty}× ${i.name_snapshot}`).join(', ')
  const more = items.length > 2 ? ` +${items.length - 2} more` : ''
  const review = order.reviews?.[0] ?? null
  const isDelivered = order.status === 'delivered'
  const isCancelled = order.status === 'cancelled' || order.status === 'expired'

  return (
    <div className="bg-white rounded-2xl p-4 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-[15px] text-ink">{order.vendors?.name}</p>
        <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${
          isDelivered ? 'bg-brand-tint text-brand-ink' :
          isCancelled ? 'bg-warn-tint text-warn' : 'bg-surface text-ink-2'
        }`}>
          {isDelivered ? 'Delivered' : isCancelled ? 'Cancelled' : order.status}
        </span>
      </div>

      <p className="text-[13px] text-ink-2">{preview}{more}</p>

      <div className="flex items-center justify-between text-[13px] text-ink-2">
        <span>{formatDate(order.created_at)}</span>
        <span className="font-semibold text-ink">{formatMoney(order.total)}</span>
      </div>

      {isDelivered && (
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onReorder}
            disabled={reordering}
            className="flex-1 h-10 rounded-xl bg-brand-tint text-brand-ink text-[14px] font-bold disabled:opacity-60"
          >
            {reordering ? 'Adding…' : 'Reorder'}
          </button>
          {review ? (
            <div className="flex items-center gap-1 px-3 h-10 rounded-xl bg-surface text-[13px] font-semibold text-ink-2">
              <Star size={13} fill="#F5A524" stroke="none" />
              <span>You rated {review.rating}</span>
            </div>
          ) : (
            <Link
              href={`/rate/${order.id}`}
              className="flex-1 h-10 rounded-xl bg-surface text-ink text-[14px] font-bold flex items-center justify-center no-underline"
            >
              Rate order
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
