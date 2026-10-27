'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/format'
import type { Vendor, Order, OrderItem, OrderStatus } from '@/types/database'

type Tab = 'paid' | 'accepted' | 'ready'
const TABS: { value: Tab; label: string }[] = [
  { value: 'paid', label: 'New' },
  { value: 'accepted', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
]

const PREP_TIMES = [10, 20, 30, 45]

interface AvailableRider {
  id: string
  name: string
  phone: string | null
  nearestArea: string
  distanceLabel: string
  locationAgeLabel: string
  hasOrderFromVendor: boolean
}

interface ConfirmAssign {
  orderId: string
  orderCode: string
  riderId: string
  riderName: string
}

interface OrderWithItems extends Order {
  order_items: OrderItem[]
}

interface Props {
  vendor: Vendor
  initialOrders: OrderWithItems[]
}

export function VendorBoardClient({ vendor, initialOrders }: Props) {
  const [orders, setOrders] = useState<OrderWithItems[]>(initialOrders)
  const [tab, setTab] = useState<Tab>('paid')
  const [prepTimes, setPrepTimes] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(vendor.is_open)

  const [availableRiders, setAvailableRiders] = useState<AvailableRider[] | null>(null)
  const [loadingRiders, setLoadingRiders] = useState(false)
  const [confirmAssign, setConfirmAssign] = useState<ConfirmAssign | null>(null)
  const [assigning, setAssigning] = useState(false)

  const supabase = createClient()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const prevNewCount = useRef(initialOrders.filter(o => o.status === 'paid').length)
  const pushSubRef = useRef<PushSubscription | null>(null)

  // Register web push subscription
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return

    navigator.serviceWorker.ready.then(async reg => {
      try {
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        })
        pushSubRef.current = sub
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub.toJSON()),
        })
      } catch {
        // Push permissions denied — audio alarm still works
      }
    })
  }, [])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`vendor:${vendor.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `vendor_id=eq.${vendor.id}` },
        payload => {
          if (payload.eventType === 'INSERT') {
            setOrders(prev => [...prev, payload.new as OrderWithItems])
          } else if (payload.eventType === 'UPDATE') {
            setOrders(prev =>
              prev.map(o => (o.id === payload.new.id ? { ...o, ...payload.new } : o))
            )
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [vendor.id])

  // Audio alarm for new orders
  useEffect(() => {
    const newCount = orders.filter(o => o.status === 'paid').length
    if (newCount > prevNewCount.current) {
      audioRef.current?.play().catch(() => {})
    }
    prevNewCount.current = newCount
  }, [orders])

  useEffect(() => {
    const newOrders = orders.filter(o => o.status === 'paid')
    if (newOrders.length === 0) return
    const interval = setInterval(() => {
      audioRef.current?.play().catch(() => {})
    }, 60_000)
    return () => clearInterval(interval)
  }, [orders])

  const tabOrders = orders.filter(o => o.status === tab)
  const newCount = orders.filter(o => o.status === 'paid').length
  const preparingCount = orders.filter(o => o.status === 'accepted').length
  const readyCount = orders.filter(o => o.status === 'ready').length

  async function transition(orderId: string, toStatus: OrderStatus, extra?: Record<string, unknown>) {
    setLoading(orderId)
    await fetch(`/api/orders/${orderId}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toStatus, ...extra }),
    })
    setLoading(null)
  }

  async function loadAvailableRiders() {
    setLoadingRiders(true)
    const res = await fetch(`/api/vendor/available-riders?vendorId=${vendor.id}`)
    const json = await res.json().catch(() => ({ riders: [] }))
    setAvailableRiders(json.riders ?? [])
    setLoadingRiders(false)
  }

  async function doAssignRider() {
    if (!confirmAssign) return
    setAssigning(true)
    const res = await fetch(`/api/orders/${confirmAssign.orderId}/assign-rider`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ riderId: confirmAssign.riderId }),
    })
    if (res.ok) {
      setOrders(prev => prev.map(o =>
        o.id === confirmAssign.orderId ? { ...o, rider_id: confirmAssign.riderId } : o
      ))
      // Re-fetch riders to refresh availability
      setAvailableRiders(null)
    }
    setAssigning(false)
    setConfirmAssign(null)
  }

  async function noRiderAvailable(orderId: string, orderCode: string) {
    await fetch(`/api/orders/${orderId}/no-rider`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendorName: vendor.name, orderCode }),
    })
  }

  async function toggleOpen() {
    const newOpen = !isOpen
    setIsOpen(newOpen)
    await supabase.from('vendors').update({ is_open: newOpen }).eq('id', vendor.id)
  }

  function elapsedLabel(ts: string | null) {
    if (!ts) return ''
    const sec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
    if (sec < 60) return `${sec}s ago`
    const min = Math.floor(sec / 60)
    return `${min}:${String(sec % 60).padStart(2, '0')} ago`
  }

  return (
    <div className="min-h-screen bg-canvas font-body text-ink flex flex-col">
      <audio
        ref={audioRef}
        src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJiVm5SnqKilpaWko6SipKWlpaampampqamop6empaWkpKOjoqGhoKCfnp6dnJybm5qampqbm5ycnZ6en6ChoqOkpaamp6ipqqusrK2trq6vr6+vr7CwsLGxsLCwr6+urq6tra2trK2srK2tra6ur7CwsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrKy8zNzs/Q0dLS09TV1tbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/w=="
      />

      {/* Confirm assign sheet */}
      {confirmAssign && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end justify-center z-50"
          onClick={() => !assigning && setConfirmAssign(null)}
        >
          <div
            className="bg-white rounded-t-3xl p-6 w-full max-w-sm flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-base font-bold text-center">
              Assign {confirmAssign.riderName} to {confirmAssign.orderCode}?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={assigning}
                onClick={() => setConfirmAssign(null)}
                className="flex-1 h-btn rounded-2xl border border-line bg-white font-body text-base font-bold text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={assigning}
                onClick={doAssignRider}
                className="flex-1 h-btn rounded-2xl bg-brand text-white font-body text-base font-bold border-0 disabled:opacity-50"
              >
                {assigning ? 'Assigning…' : 'Yes, assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="px-4 pt-4.5 pb-3 bg-ink text-white flex items-center justify-between">
        <span className="flex flex-col">
          <span className="text-xs text-[#B9BEC4]">Vendor dashboard</span>
          <span className="font-heading font-extrabold text-xl">{vendor.name}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isOpen}
          aria-label="Taking orders"
          onClick={toggleOpen}
          className={`flex items-center gap-2 h-10 pl-3 pr-1.5 rounded-full border-0 font-body text-[13px] font-bold text-white transition-colors ${isOpen ? 'bg-brand' : 'bg-[#3A3D42]'}`}
        >
          {isOpen ? 'Open' : 'Closed'}
          <span className="w-7 h-7 rounded-full bg-white" />
        </button>
      </header>

      <div role="tablist" className="grid grid-cols-3 gap-1.5 px-4 py-3 bg-ink">
        {TABS.map(t => {
          const count = t.value === 'paid' ? newCount : t.value === 'accepted' ? preparingCount : readyCount
          return (
            <button
              key={t.value}
              role="tab"
              type="button"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={`h-11 border-0 rounded-xl font-body text-sm font-bold transition-colors ${tab === t.value ? 'bg-white text-ink' : 'bg-[#2A2D31] text-[#E3E6E9]'}`}
            >
              {t.label} · {count}
            </button>
          )
        })}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3 pb-24">
        {tabOrders.length === 0 && (
          <p className="text-center text-ink-2 py-10">
            No {tab === 'paid' ? 'new' : tab === 'accepted' ? 'preparing' : 'ready'} orders
          </p>
        )}

        {tabOrders.map(order => (
          <article
            key={order.id}
            className={`bg-white rounded-[18px] p-4 flex flex-col gap-3 ${tab === 'paid' ? 'border-2 border-[#E8890C]' : 'border border-line'}`}
          >
            <div className="flex justify-between items-center">
              {tab === 'paid' ? (
                <span className="flex items-center gap-2 text-[13px] font-bold text-warn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>
                  NEW ORDER · {elapsedLabel(order.paid_at)}
                </span>
              ) : (
                <span className="text-[13px] text-ink-2">
                  {tab === 'accepted' ? `Accepted ${elapsedLabel(order.accepted_at)}` : 'Ready for pickup'}
                </span>
              )}
              <span className="text-[13px] font-bold">{order.code}</span>
            </div>

            <div className="flex flex-col gap-2.5">
              {order.order_items.map(oi => (
                <div key={oi.id} className="flex gap-2.5 items-baseline">
                  <span className="text-xl font-extrabold">{oi.qty}&times;</span>
                  <span className="flex flex-col">
                    <span className="text-lg font-bold">{oi.name_snapshot}</span>
                    {oi.options_snapshot.length > 0 && (
                      <span className="text-sm text-ink-2">
                        {(oi.options_snapshot as { option_name: string }[]).map(o => o.option_name).join(' · ')}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className="h-px bg-line" />

            {tab === 'paid' && (
              <>
                <span className="text-[13px] font-bold">Ready in how long?</span>
                <div className="grid grid-cols-4 gap-2">
                  {PREP_TIMES.map(t => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={prepTimes[order.id] === t}
                      onClick={() => setPrepTimes(p => ({ ...p, [order.id]: t }))}
                      className={`h-11 rounded-xl font-body text-[15px] font-semibold border transition-colors ${prepTimes[order.id] === t ? 'border-2 border-ink bg-ink text-white font-bold' : 'border-line bg-white text-ink'}`}
                    >
                      {t}m
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={loading === order.id}
                    onClick={() => transition(order.id, 'cancelled', { note: 'Vendor rejected' })}
                    className="h-btn px-4.5 rounded-[14px] border border-line bg-white font-body text-[15px] font-bold text-danger disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={loading === order.id || !prepTimes[order.id]}
                    onClick={() => transition(order.id, 'accepted', { prepMins: prepTimes[order.id] })}
                    className="flex-1 h-btn rounded-[14px] border-0 bg-brand font-body text-[17px] font-extrabold text-white disabled:opacity-50"
                  >
                    {loading === order.id ? 'Accepting…' : 'Accept order'}
                  </button>
                </div>
              </>
            )}

            {tab === 'accepted' && (
              <>
                {/* Rider assignment */}
                {!order.rider_id ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-bold text-ink-2">Assign a rider — call first, then tap Assign</span>
                      {availableRiders !== null && (
                        <button
                          type="button"
                          onClick={loadAvailableRiders}
                          disabled={loadingRiders}
                          className="text-[12px] text-brand font-semibold"
                        >
                          Refresh
                        </button>
                      )}
                    </div>

                    {availableRiders === null ? (
                      <button
                        type="button"
                        onClick={loadAvailableRiders}
                        disabled={loadingRiders}
                        className="h-10 rounded-xl bg-brand-tint text-brand-ink text-sm font-bold border-0 disabled:opacity-50"
                      >
                        {loadingRiders ? 'Finding riders…' : 'Find available riders'}
                      </button>
                    ) : availableRiders.length === 0 ? (
                      <p className="text-[13px] text-ink-2 text-center py-2">No riders available right now</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {availableRiders.map(r => (
                          <div key={r.id} className="flex items-start gap-2 py-2 border-b border-line last:border-0">
                            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold">{r.name}</span>
                                {r.hasOrderFromVendor && (
                                  <span className="text-[10px] font-bold bg-brand-tint text-brand-ink px-1.5 py-0.5 rounded-md">
                                    Has order from you
                                  </span>
                                )}
                              </div>
                              <span className="text-[12px] text-ink-2">
                                {r.nearestArea || '—'} · {r.distanceLabel} · {r.locationAgeLabel}
                              </span>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              {r.phone && (
                                <a
                                  href={`tel:${r.phone}`}
                                  className="h-9 px-3 rounded-xl border border-line text-sm font-semibold text-ink-2 flex items-center no-underline"
                                >
                                  Call
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => setConfirmAssign({ orderId: order.id, orderCode: order.code, riderId: r.id, riderName: r.name })}
                                className="h-9 px-3 rounded-xl bg-brand text-white text-sm font-bold border-0"
                              >
                                Assign
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => noRiderAvailable(order.id, order.code)}
                      className="h-btn-sm rounded-xl border border-danger text-danger text-sm font-bold bg-white"
                    >
                      No rider available
                    </button>
                  </div>
                ) : (
                  <span className="text-[13px] text-brand font-semibold">Rider assigned ✓</span>
                )}

                <button
                  type="button"
                  disabled={loading === order.id}
                  onClick={() => transition(order.id, 'ready')}
                  className="h-btn-sm rounded-xl border-0 bg-brand-tint text-brand-ink font-body text-sm font-bold disabled:opacity-50"
                >
                  Mark ready
                </button>
              </>
            )}

            {tab === 'ready' && (
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold text-brand">Waiting for pickup</span>
                <span className="text-[13px] text-ink-2">{order.code}</span>
              </div>
            )}
          </article>
        ))}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 h-[72px] px-3 pb-3.5 pt-2 bg-white border-t border-line grid grid-cols-3">
        <Link href="/vendor/orders" className="flex flex-col items-center justify-center gap-1 text-xs font-bold text-brand no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 4h10a1 1 0 0 1 1 1v15l-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1z"/></svg>
          Orders
        </Link>
        <Link href="/vendor/menu" className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-ink-2 no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 6h14M5 12h14M5 18h9"/></svg>
          Menu
        </Link>
        <Link href="/vendor/earnings" className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-ink-2 no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/></svg>
          Earnings
        </Link>
      </nav>
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const arr = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i)
  return arr.buffer
}
