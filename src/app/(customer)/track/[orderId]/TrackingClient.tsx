'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { X, Phone, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatTime, formatMoney } from '@/lib/format'
import type { OrderEvent, OrderItem, OrderStatus } from '@/types/database'

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
  const [flash, setFlash] = useState(false)
  const [justCompleted, setJustCompleted] = useState<OrderStatus | null>(null)
  const [now, setNow] = useState(Date.now())
  const prevStatusRef = useRef<OrderStatus>(initialOrder.status as OrderStatus)
  const supabase = createClient()

  const status = order.status as OrderStatus
  const vendor = order.vendors as { name: string; cover_photo_url: string | null } | null
  const rider = order.profiles as { full_name: string | null } | null

  // Clock tick for prep countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000)
    return () => clearInterval(t)
  }, [])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`order:${order.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` },
        payload => {
          const newStatus = payload.new.status as OrderStatus | undefined
          if (newStatus && newStatus !== prevStatusRef.current) {
            setJustCompleted(prevStatusRef.current)
            prevStatusRef.current = newStatus
            setFlash(true)
          }
          setOrder(prev => ({ ...prev, ...payload.new }))
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_events', filter: `order_id=eq.${order.id}` },
        payload => setEvents(prev => [...prev, payload.new as OrderEvent])
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [order.id])

  // Clear flash after animation completes
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(false), 900)
    return () => clearTimeout(t)
  }, [flash])

  // Clear justCompleted after checkmark animation
  useEffect(() => {
    if (!justCompleted) return
    const t = setTimeout(() => setJustCompleted(null), 500)
    return () => clearTimeout(t)
  }, [justCompleted])

  const isProblem = status === 'cancelled' || status === 'expired'
  const isActive = !isProblem && status !== 'delivered'

  const prepMinsLeft = (status === 'accepted' && order.prep_mins && order.accepted_at)
    ? Math.max(0, (order.prep_mins as number) - Math.floor((now - new Date(order.accepted_at as string).getTime()) / 60000))
    : null

  const headlineMap: Partial<Record<OrderStatus, string>> = {
    pending_payment: isConfirmRedirect ? 'Confirming payment…' : 'Awaiting payment',
    paid: 'Order confirmed!',
    accepted: 'Kitchen is cooking',
    ready: 'Ready for pickup',
    picked_up: 'Rider is on the way',
    delivered: 'Delivered!',
    cancelled: 'Order cancelled',
    expired: 'Order expired',
  }

  const subtitleMap: Partial<Record<OrderStatus, string>> = {
    pending_payment: isConfirmRedirect
      ? 'Updates automatically — no need to refresh'
      : 'Waiting for payment to be confirmed.',
    paid: 'The kitchen will accept shortly.',
    accepted: prepMinsLeft != null
      ? prepMinsLeft > 0 ? `Ready in about ${prepMinsLeft} min` : 'Should be ready any moment'
      : 'Being prepared now',
    ready: 'Rider will pick up soon',
    picked_up: 'Arriving soon',
    delivered: 'Enjoy your order!',
  }

  const timelineSteps = HAPPY_PATH.map((s, i) => {
    const event = events.find(e => e.to_status === s)
    const statusIdx = HAPPY_PATH.indexOf(status)
    const isDone = i < statusIdx || status === 'delivered'
    const isCurrent = i === statusIdx && !isProblem
    const isTodo = i > statusIdx

    return {
      status: s,
      label: STATUS_LABELS[s],
      time: event
        ? formatTime(event.created_at)
        : isCurrent ? 'Now' : '',
      isDone,
      isCurrent,
      isTodo,
      hasLine: i < HAPPY_PATH.length - 1,
    }
  })

  const deliveryPin = order.delivery_pin as string

  return (
    <div className="min-h-screen bg-white flex flex-col font-body text-ink">

      {/* ── Header ── */}
      <div className={`relative px-5 pt-4 pb-6 flex flex-col gap-1.5 overflow-hidden transition-colors duration-700 ${isProblem ? 'bg-danger' : 'bg-brand'} text-white`}>

        {/* Flash overlay on status change */}
        {flash && (
          <span className="absolute inset-0 bg-white pointer-events-none animate-flash-fade" />
        )}

        {/* Order ref + close */}
        <div className="flex justify-between items-center">
          <span className="text-[13px] font-semibold text-white/80">
            Order {order.code as string} · {vendor?.name}
          </span>
          <Link href="/" aria-label="Close" className="w-11 h-11 flex items-center justify-center -mr-2.5">
            <X size={20} strokeWidth={2.2} stroke="white" />
          </Link>
        </div>

        {/* LIVE badge */}
        {isActive && (
          <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-white/60 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Live
          </span>
        )}

        {/* Headline — re-mounts on each status change to animate in */}
        <h1 key={status} className="font-heading font-extrabold text-[30px] leading-tight animate-status-in">
          {status === 'pending_payment' && isConfirmRedirect ? (
            <span className="flex items-center gap-3">
              <svg className="animate-spin shrink-0" width="28" height="28" viewBox="0 0 24 24"
                fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Confirming payment…
            </span>
          ) : (
            headlineMap[status] ?? STATUS_LABELS[status]
          )}
        </h1>

        {subtitleMap[status] && (
          <span key={`sub-${status}`} className="text-[15px] text-white/80 animate-status-in">
            {subtitleMap[status]}
          </span>
        )}
      </div>

      {/* ── Delivery PIN card ── */}
      {(status === 'picked_up' || status === 'ready') && deliveryPin && (
        <div className="mx-4 -mt-3 bg-white border border-line rounded-2xl px-4 py-3.5 flex items-center justify-between shadow-sm">
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

      {/* ── Rider card ── */}
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

      {/* ── Timeline ── */}
      <ol aria-label="Order progress" className="list-none m-0 pt-5 px-5 flex flex-col">
        {timelineSteps.map(step => (
          <li key={step.status} className="flex gap-3.5 min-h-[60px]">

            {/* Step indicator column */}
            <span className="flex flex-col items-center w-6 flex-none">

              {step.isDone && (
                <span
                  key={`done-${step.status}-${justCompleted === step.status}`}
                  className={`w-6 h-6 rounded-full bg-brand flex items-center justify-center ${justCompleted === step.status ? 'animate-check-pop' : ''}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
              )}

              {step.isCurrent && (
                <span className="relative w-6 h-6 flex items-center justify-center">
                  <span className="animate-ping absolute w-6 h-6 rounded-full bg-brand opacity-25" />
                  <span className="relative w-6 h-6 rounded-full border-[7px] border-brand bg-white" />
                </span>
              )}

              {step.isTodo && (
                <span className="w-6 h-6 rounded-full border-2 border-[#C3C8CD]" />
              )}

              {/* Connecting line */}
              {step.hasLine && (
                <span className={`flex-1 w-0.5 mt-1 transition-colors duration-700 ${step.isDone ? 'bg-brand' : 'bg-[#E1E4E7]'}`} />
              )}
            </span>

            {/* Step text */}
            <span className="flex flex-col gap-0.5 pt-0.5 pb-3.5">
              <span className={`text-[15px] ${step.isTodo ? 'font-medium text-ink-2' : 'font-bold'}`}>
                {step.label}
              </span>
              {step.time && (
                <span className="text-[13px] text-ink-2">{step.time}</span>
              )}
              {/* Live prep countdown */}
              {step.isCurrent && step.status === 'accepted' && prepMinsLeft != null && (
                <span className="text-[13px] text-brand font-semibold">
                  {prepMinsLeft > 0 ? `~${prepMinsLeft} min remaining` : 'Almost ready'}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>

      {/* ── Order items ── */}
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

      {/* ── Footer ── */}
      <div className="mt-auto px-5 py-4 border-t border-line flex justify-between items-center">
        <span className="text-sm text-ink-2">Problem with this order?</span>
        <a href="tel:" className="min-h-btn-sm flex items-center text-sm font-bold text-brand">Call support</a>
      </div>
    </div>
  )
}
