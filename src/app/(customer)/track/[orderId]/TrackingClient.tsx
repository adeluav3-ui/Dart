'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { X, Phone, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatTime, formatMoney } from '@/lib/format'
import type { Order, OrderEvent, OrderItem, OrderStatus } from '@/types/database'

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Awaiting payment',
  paid: 'Payment confirmed',
  accepted: 'Kitchen accepted',
  ready: 'Food packed and ready',
  picked_up: 'Picked up by rider',
  delivered: 'Delivered',
  cancelled: 'Order cancelled',
  expired: 'Order expired',
}

const HAPPY_PATH: OrderStatus[] = ['pending_payment', 'paid', 'accepted', 'ready', 'picked_up', 'delivered']

interface Props {
  initialOrder: Record<string, unknown>
  initialEvents: OrderEvent[]
  orderItems: OrderItem[]
  isConfirmRedirect: boolean
}

export function TrackingClient({ initialOrder, initialEvents, orderItems, isConfirmRedirect }: Props) {
  const [order, setOrder] = useState<Record<string, unknown>>(initialOrder)
  const [events, setEvents] = useState<OrderEvent[]>(initialEvents)
  const [feeInfoOpen, setFeeInfoOpen] = useState(false)
  const supabase = createClient()

  const status = order.status as OrderStatus
  const vendor = order.vendors as { name: string; cover_photo_url: string | null } | null
  const rider = order.profiles as { full_name: string | null } | null

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`order:${order.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` },
        payload => setOrder(prev => ({ ...prev, ...payload.new }))
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_events', filter: `order_id=eq.${order.id}` },
        payload => setEvents(prev => [...prev, payload.new as OrderEvent])
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [order.id])

  const headlineMap: Partial<Record<OrderStatus, string>> = {
    pending_payment: isConfirmRedirect ? 'Confirming payment…' : 'Awaiting payment',
    paid: 'Order confirmed!',
    accepted: 'Kitchen is cooking',
    ready: 'Ready for pickup',
    picked_up: 'Your rider is on the way',
    delivered: 'Delivered!',
    cancelled: 'Order cancelled',
    expired: 'Order expired',
  }

  const subtitleMap: Partial<Record<OrderStatus, string>> = {
    pending_payment: isConfirmRedirect ? 'This updates automatically — no need to refresh.' : 'Waiting for payment to be confirmed.',
    paid: 'The kitchen will accept shortly.',
    accepted: order.prep_mins ? `Ready in about ${order.prep_mins} min` : 'Being prepared now',
    ready: 'Rider will pick up soon',
    picked_up: 'Arriving soon',
    delivered: 'Enjoy your order!',
  }

  const isProblem = status === 'cancelled' || status === 'expired'

  // Build timeline
  const timelineSteps = HAPPY_PATH.map((s, i) => {
    const event = events.find(e => e.to_status === s)
    const statusIdx = HAPPY_PATH.indexOf(status)
    const stepIdx = i
    const isDone = stepIdx < statusIdx || status === 'delivered'
    const isCurrent = stepIdx === statusIdx && !isProblem
    const isTodo = stepIdx > statusIdx

    return {
      status: s,
      label: STATUS_LABELS[s],
      time: event ? formatTime(event.created_at) : (s === 'accepted' && order.prep_mins ? `Ready in ${order.prep_mins} min` : isCurrent ? 'Now' : ''),
      isDone,
      isCurrent,
      isTodo,
      hasLine: i < HAPPY_PATH.length - 1,
    }
  })

  const deliveryPin = order.delivery_pin as string

  return (
    <div className="min-h-screen bg-white flex flex-col font-body text-ink">
      {/* Header */}
      <div className={`px-5 pt-4 pb-6 flex flex-col gap-1.5 ${isProblem ? 'bg-danger' : 'bg-brand'} text-white`}>
        <div className="flex justify-between items-center">
          <span className="text-[13px] font-semibold text-white/80">
            Order {order.code as string} · {vendor?.name}
          </span>
          <Link href="/" aria-label="Close" className="w-11 h-11 flex items-center justify-center -mr-2.5">
            <X size={20} strokeWidth={2.2} stroke="white" />
          </Link>
        </div>
        <h1 className="font-heading font-extrabold text-[30px] leading-tight">
          {headlineMap[status] ?? STATUS_LABELS[status]}
        </h1>
        {subtitleMap[status] && (
          <span className="text-[15px] text-white/80">{subtitleMap[status]}</span>
        )}
      </div>

      {/* Delivery PIN card */}
      {(status === 'picked_up' || status === 'ready') && deliveryPin && (
        <div className="mx-4 -mt-3 bg-white border border-line rounded-2xl px-4 py-3.5 flex items-center justify-between">
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] font-bold">Delivery PIN</span>
            <span className="text-xs text-ink-2 leading-snug max-w-[170px]">Tell the rider only when the food is in your hand</span>
          </span>
          <span className="flex gap-1.5">
            {deliveryPin.split('').map((d, i) => (
              <span key={i} className="w-[34px] h-11 rounded-[10px] bg-surface flex items-center justify-center font-heading font-extrabold text-2xl">
                {d}
              </span>
            ))}
          </span>
        </div>
      )}

      {/* Rider card */}
      {rider && status === 'picked_up' && (
        <div className="mx-4 mt-3.5 bg-canvas rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="w-11 h-11 rounded-full bg-ink text-white flex items-center justify-center font-bold text-sm">
            {rider.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '??'}
          </span>
          <span className="flex-1 flex flex-col">
            <span className="text-[15px] font-bold">{rider.full_name ?? 'Your rider'}</span>
            <span className="text-[13px] text-ink-2">Your rider</span>
          </span>
          <a
            href={`tel:${order.address_phone}`}
            aria-label="Call rider"
            className="w-11 h-11 rounded-full bg-brand flex items-center justify-center"
          >
            <Phone size={20} stroke="white" strokeWidth={2} />
          </a>
        </div>
      )}

      {/* Timeline */}
      <ol aria-label="Order progress" className="list-none m-0 pt-5 px-5 flex flex-col">
        {timelineSteps.map(step => (
          <li key={step.status} className="flex gap-3.5 min-h-[60px]">
            <span className="flex flex-col items-center w-6 flex-none">
              {step.isDone && (
                <span className="w-6 h-6 rounded-full bg-brand flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                </span>
              )}
              {step.isCurrent && (
                <span className="w-6 h-6 rounded-full border-[7px] border-brand bg-white" />
              )}
              {step.isTodo && (
                <span className="w-6 h-6 rounded-full border-2 border-[#C3C8CD]" />
              )}
              {step.hasLine && (
                <span className={`flex-1 w-0.5 ${step.isDone ? 'bg-brand' : 'bg-[#E1E4E7]'}`} />
              )}
            </span>
            <span className="flex flex-col gap-0.5 pt-0.5 pb-3.5">
              <span className={`text-[15px] ${step.isTodo ? 'font-medium text-ink-2' : 'font-bold'}`}>
                {step.label}
              </span>
              {step.time && (
                <span className="text-[13px] text-ink-2">{step.time}</span>
              )}
            </span>
          </li>
        ))}
      </ol>

      {/* Order items */}
      <div className="mx-4 mt-2 mb-4 bg-canvas rounded-2xl p-4 flex flex-col gap-2">
        <h2 className="text-[15px] font-bold">Your order</h2>
        {orderItems.map(oi => (
          <div key={oi.id} className="flex gap-2 text-sm">
            <span className="font-bold">{oi.qty}×</span>
            <span className="flex-1">{oi.name_snapshot}</span>
            <span className="font-semibold">{formatMoney(oi.line_total)}</span>
          </div>
        ))}
        <div className="border-t border-line mt-1 pt-2 flex flex-col gap-1.5">
          <div className="flex justify-between text-sm text-ink-2">
            <span>Items</span>
            <span>{formatMoney(order.subtotal as number)}</span>
          </div>
          {(order.delivery_fee as number) > 0 && (
            <div className="flex justify-between text-sm text-ink-2">
              <span>Delivery</span>
              <span>{formatMoney(order.delivery_fee as number)}</span>
            </div>
          )}
          {(order.service_fee as number) > 0 && (
            <div className="flex justify-between text-sm text-ink-2 items-center">
              <button
                type="button"
                onClick={() => setFeeInfoOpen(p => !p)}
                className="flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 text-ink-2"
              >
                Service fee
                <Info size={12} strokeWidth={2} className="opacity-60" />
              </button>
              <span>{formatMoney(order.service_fee as number)}</span>
            </div>
          )}
          {feeInfoOpen && (
            <p className="text-[11px] text-ink-2 bg-white rounded-lg px-2.5 py-1.5 leading-relaxed">
              Helps us run Dart: payments, support and refunds.
            </p>
          )}
          <div className="flex justify-between font-bold text-sm pt-1 border-t border-line">
            <span>Total</span>
            <span>{formatMoney(order.total as number)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto px-5 py-4 border-t border-line flex justify-between items-center">
        <span className="text-sm text-ink-2">Problem with this order?</span>
        <a href="tel:" className="min-h-btn-sm flex items-center text-sm font-bold text-brand">Call support</a>
      </div>
    </div>
  )
}
