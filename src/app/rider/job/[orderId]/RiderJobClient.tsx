'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, Map, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatMoney, formatTime } from '@/lib/format'

interface Order {
  id: string
  code: string
  status: string
  rider_pay: number
  area_name: string | null
  address_zone: string
  address_landmark: string
  address_details: string | null
  address_phone: string
  is_gate_pickup: boolean
  gate_arrived_at: string | null
  gate_no_show: boolean
  gate_no_show_at: string | null
  prep_mins: number | null
  accepted_at: string | null
  ready_at: string | null
  customer_id: string
  vendor_id: string
}

interface OrderItem { name_snapshot: string; qty: number; line_total: number }

interface Props {
  order: Order
  vendorName: string
  vendorAreaName: string | null
  vendorDistance: string | null
  customerName: string | null
  orderItems: OrderItem[]
}

const WAIT_MS = 10 * 60 * 1000

function initials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0].slice(0, 2).toUpperCase()
}

function firstName(name: string | null): string {
  if (!name) return 'Customer'
  return name.trim().split(/\s+/)[0]
}

function nameWithInitial(name: string | null): string {
  if (!name) return 'Customer'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

// ── SVG countdown ring ──────────────────────────────────────────────────────
function CountdownRing({ elapsedMs, totalMs }: { elapsedMs: number; totalMs: number }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const progress = Math.min(elapsedMs / totalMs, 1)
  const dash = circ * progress
  const secsTotal = Math.max(0, Math.ceil((totalMs - elapsedMs) / 1000))
  const mins = Math.floor(secsTotal / 60)
  const secs = String(secsTotal % 60).padStart(2, '0')
  const elapsedSecs = Math.floor(elapsedMs / 1000)
  const em = Math.floor(elapsedSecs / 60)
  const es = String(elapsedSecs % 60).padStart(2, '0')

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke="#E7F4EC" strokeWidth="9" />
        <circle
          cx="65" cy="65" r={r} fill="none"
          stroke="#0B7A47" strokeWidth="9"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 65 65)"
        />
        <text x="65" y="60" textAnchor="middle" fontFamily="Bricolage Grotesque, sans-serif"
          fontWeight="800" fontSize="24" fill="#15171A">
          {em}:{es}
        </text>
        <text x="65" y="79" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif"
          fontSize="12" fill="#5B6168">
          of 10:00
        </text>
      </svg>
      <div className="text-center">
        <p className="text-[15px] font-bold text-ink">You&apos;ve been waiting {em} min {es} s</p>
      </div>
    </div>
  )
}

// ── Pin entry ───────────────────────────────────────────────────────────────
function PinEntry({
  value, onChange, error,
}: { value: string; onChange: (v: string) => void; error: string }) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] font-semibold text-ink-2 text-center">Enter customer PIN</p>
      <div
        className="flex gap-3 justify-center cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {[0, 1, 2, 3].map(i => (
          <div key={i}
            className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold font-heading transition-colors ${
              value.length === i ? 'border-brand bg-brand-tint' : value[i] ? 'border-line bg-white' : 'border-line bg-surface'
            }`}>
            {value[i] ? '•' : ''}
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        maxLength={4}
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        className="opacity-0 absolute w-0 h-0"
        autoFocus
      />
      {error && <p className="text-sm text-danger text-center">{error}</p>}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export function RiderJobClient({
  order: initialOrder, vendorName, vendorAreaName, vendorDistance, customerName, orderItems,
}: Props) {
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  const [order, setOrder] = useState(initialOrder)
  const [now, setNow] = useState(Date.now())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)

  const customerArea = order.area_name ?? order.address_zone

  // Clock tick for countdown + prep time
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Keep location fresh while job is active — same cadence as the jobs list page
  useEffect(() => {
    const ACTIVE = ['accepted', 'ready', 'picked_up']
    if (!ACTIVE.includes(order.status)) return
    if (!navigator.geolocation) return

    const push = () => {
      navigator.geolocation.getCurrentPosition(pos => {
        fetch('/api/rider/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            available: true,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }),
        }).catch(() => {})
      }, () => {}, { timeout: 10_000, maximumAge: 60_000 })
    }

    push() // immediate update on mount / status change
    const t = setInterval(push, 2 * 60 * 1000)
    return () => clearInterval(t)
  }, [order.status])

  // Realtime order updates
  useEffect(() => {
    const client = supabaseRef.current
    const channel = client
      .channel(`job:${order.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` },
        payload => { setOrder(prev => ({ ...prev, ...payload.new })) }
      )
      .subscribe()
    return () => { client.removeChannel(channel) }
  }, [order.id])

  async function post(path: string, body?: object) {
    setLoading(true)
    setError('')
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setError(json.error ?? 'Something went wrong'); return false }
    return true
  }

  async function markPickedUp() {
    const ok = await post(`/api/orders/${order.id}/transition`, { toStatus: 'picked_up' })
    if (ok) setOrder(prev => ({ ...prev, status: 'picked_up' }))
  }

  async function markArrived() {
    const path = order.is_gate_pickup
      ? `/api/orders/${order.id}/gate-arrived`
      : `/api/orders/${order.id}/arrived`
    const ok = await post(path)
    if (ok) setOrder(prev => ({ ...prev, gate_arrived_at: new Date().toISOString() }))
  }

  async function confirmDelivery() {
    if (pin.length !== 4) { setError('Enter all 4 digits'); return }
    const ok = await post(`/api/orders/${order.id}/transition`, {
      toStatus: 'delivered', deliveryPin: pin,
    })
    if (ok) router.replace('/rider/jobs')
  }

  async function markNoShow() {
    const ok = await post(`/api/orders/${order.id}/no-show`)
    if (ok) setOrder(prev => ({ ...prev, gate_no_show: true, gate_no_show_at: new Date().toISOString() }))
  }

  const arrivedAt = order.gate_arrived_at ? new Date(order.gate_arrived_at).getTime() : null
  const elapsedMs = arrivedAt ? now - arrivedAt : 0
  const canNoShow = !!arrivedAt && elapsedMs >= WAIT_MS
  const noShowSecsLeft = arrivedAt ? Math.max(0, Math.ceil((WAIT_MS - elapsedMs) / 1000)) : 0
  const noShowMinsLeft = Math.floor(noShowSecsLeft / 60)
  const noShowSecsDisplay = String(noShowSecsLeft % 60).padStart(2, '0')

  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(customerArea + ', Sagamu, Ogun State')}`
  const vendorMapsUrl = vendorAreaName
    ? `https://maps.google.com/?q=${encodeURIComponent(vendorAreaName + ', Sagamu, Ogun State')}`
    : null

  // ── Phase: Delivered (shouldn't normally render since we redirect) ─────────
  if (order.status === 'delivered') {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-16 h-16 rounded-full bg-brand-tint flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0B7A47" strokeWidth="2.5" strokeLinecap="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>
        <p className="font-heading font-extrabold text-2xl text-ink">Delivered!</p>
        <p className="text-brand font-bold text-xl">+{formatMoney(order.rider_pay)}</p>
        <button type="button" onClick={() => router.replace('/rider/jobs')}
          className="h-btn px-8 rounded-2xl bg-brand text-white font-bold text-base">
          Back to jobs
        </button>
      </div>
    )
  }

  // ── Phase: Pickup (accepted or ready) ─────────────────────────────────────
  if (order.status === 'accepted' || order.status === 'ready') {
    const isReady = order.status === 'ready'
    const prepMinsLeft = order.prep_mins && order.accepted_at
      ? Math.max(0, order.prep_mins - Math.floor((now - new Date(order.accepted_at).getTime()) / 60000))
      : null

    return (
      <div className="min-h-screen bg-canvas font-body text-ink flex flex-col">
        {/* Dark header */}
        <div className="bg-ink flex flex-col" style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
          <Link href="/rider/jobs" className="flex items-center gap-1 px-3 pt-1 pb-0 text-white/60 no-underline w-fit">
            <ArrowLeft size={18} strokeWidth={2} />
            <span className="text-[13px] font-medium">Jobs</span>
          </Link>
          <div className="flex items-start justify-between px-4 pb-1">
            <div>
              <p className="text-[11px] text-white/50 font-medium tracking-wide mb-0.5">{order.code} · Step 1 of 2</p>
              <p className="font-heading font-extrabold text-[20px] text-white leading-tight">Go to the vendor</p>
            </div>
            <span className="mt-1 px-3 py-1.5 rounded-xl bg-brand text-white text-[13px] font-bold shrink-0">
              {formatMoney(order.rider_pay)} this trip
            </span>
          </div>
          {/* Progress bar */}
          <div className="flex gap-1.5 px-4 pb-3 pt-2">
            <div className="flex-1 h-1 rounded-full bg-white" />
            <div className="flex-1 h-1 rounded-full bg-white/25" />
          </div>
        </div>

        <div className="px-4 py-4 flex flex-col gap-3 flex-1">
          {/* Vendor card — green border */}
          <div className="bg-white rounded-2xl border-2 border-brand p-4 flex flex-col gap-3">
            <p className="text-[11px] font-bold text-brand tracking-wide uppercase">Pick up from</p>
            <div>
              <p className="font-heading font-extrabold text-[18px] text-ink leading-tight">{vendorName}</p>
              <p className="text-[13px] text-ink-2 mt-0.5">
                {vendorAreaName ?? 'Loading…'}{vendorDistance ? ` · ${vendorDistance} from you` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <a href="tel:" className="flex-1 h-10 rounded-xl bg-brand text-white font-bold text-[13px] flex items-center justify-center gap-1.5 no-underline">
                <Phone size={14} /> Call vendor
              </a>
              {vendorMapsUrl && (
                <a href={vendorMapsUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-1 h-10 rounded-xl bg-surface border border-line text-[13px] font-bold text-ink flex items-center justify-center gap-1.5 no-underline">
                  <Map size={14} /> Open in Maps
                </a>
              )}
            </div>
            {/* Live prep status */}
            {!isReady && (
              <div className="flex items-center gap-2 bg-warn-tint rounded-xl px-3 py-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A4B08" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span className="text-[13px] text-warn">
                  Kitchen is preparing{prepMinsLeft != null ? ` · ready in about ${prepMinsLeft} min` : ''}
                </span>
              </div>
            )}
            {isReady && (
              <div className="flex items-center gap-2 bg-brand-tint rounded-xl px-3 py-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0A4F30" strokeWidth="2" strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                <span className="text-[13px] text-brand-ink font-semibold">Ready for pickup</span>
              </div>
            )}
            <p className="text-[12px] text-ink-2">
              Show the vendor order code <span className="font-bold text-ink">{order.code}</span>
              {' · '}{orderItems.length} item{orderItems.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Delivery destination (greyed) */}
          <div className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B6168" strokeWidth="2" strokeLinecap="round">
                <path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z"/>
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-bold text-ink-2 tracking-wide uppercase">Then deliver to</p>
              <p className="text-[15px] font-bold text-ink">{customerArea} · {nameWithInitial(customerName)}</p>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-danger text-center px-4 pb-2">{error}</p>}

        {/* Fixed bottom */}
        <div className="px-4 pb-5 pt-2 bg-white border-t border-line flex flex-col gap-1"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
          <button
            type="button"
            disabled={!isReady || loading}
            onClick={markPickedUp}
            className={`h-btn rounded-2xl font-bold text-base transition-colors ${
              isReady ? 'bg-brand text-white' : 'bg-surface text-ink-2/50'
            } disabled:opacity-60`}
          >
            {loading ? 'Confirming…' : "I've picked it up"}
          </button>
          {!isReady && (
            <p className="text-[12px] text-ink-2 text-center">Unlocks when the vendor marks the order ready</p>
          )}
        </div>
      </div>
    )
  }

  // ── Phase: Deliver (picked_up) ─────────────────────────────────────────────
  if (order.status === 'picked_up') {

    // R4: Gate waiting (after arrival)
    if (order.is_gate_pickup && arrivedAt) {
      return (
        <div className="min-h-screen bg-canvas font-body text-ink flex flex-col">
          <div className="bg-ink pb-4" style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
            <Link href="/rider/jobs" className="flex items-center gap-1 px-3 pt-1 pb-1 text-white/60 no-underline w-fit">
              <ArrowLeft size={18} strokeWidth={2} />
              <span className="text-[13px] font-medium">Jobs</span>
            </Link>
            <p className="text-[11px] text-white/50 font-medium tracking-wide mb-0.5 px-4">{order.code} · Gate pickup</p>
            <p className="font-heading font-extrabold text-[20px] text-white leading-tight px-4">Waiting at {customerArea}</p>
          </div>

          <div className="px-4 py-4 flex flex-col gap-3 flex-1">
            {/* Timer card */}
            <div className="bg-white rounded-2xl p-4 flex flex-col items-center gap-2">
              <CountdownRing elapsedMs={elapsedMs} totalMs={WAIT_MS} />
              <p className="text-[13px] text-ink-2 text-center leading-relaxed">
                We emailed {firstName(customerName)} at {formatTime(order.gate_arrived_at!)} that you&apos;re at the gate.
                Call {firstName(customerName)} if {firstName(customerName) === 'Customer' ? 'they aren\'t' : 'they\'re not'} out yet.
              </p>
            </div>

            {/* Customer card */}
            <div className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-tint flex items-center justify-center shrink-0">
                <span className="font-heading font-bold text-[14px] text-brand-ink">{initials(customerName)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-ink">{nameWithInitial(customerName)}</p>
                <p className="text-[12px] text-ink-2">{order.address_phone}</p>
              </div>
              <a href={`tel:${order.address_phone}`}
                className="h-10 px-4 rounded-xl bg-brand text-white text-[13px] font-bold flex items-center gap-1.5 no-underline shrink-0">
                <Phone size={14} /> Call
              </a>
            </div>

            {order.gate_no_show && (
              <div className="bg-warn-tint rounded-2xl px-4 py-3 text-[13px] text-warn text-center font-semibold">
                No-show recorded — admin will decide on refund
              </div>
            )}
          </div>

          {error && <p className="text-sm text-danger text-center px-4 pb-2">{error}</p>}

          {!order.gate_no_show && (
            <div className="px-4 pb-5 pt-2 bg-white border-t border-line flex flex-col gap-2"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
              {showPin ? (
                <>
                  <PinEntry value={pin} onChange={setPin} error={error} />
                  <button
                    type="button"
                    disabled={pin.length !== 4 || loading}
                    onClick={confirmDelivery}
                    className="h-btn rounded-2xl bg-brand text-white font-bold text-base disabled:opacity-50"
                  >
                    {loading ? 'Verifying…' : 'Confirm delivery'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowPin(true)}
                    className="h-btn rounded-2xl bg-brand text-white font-bold text-base"
                  >
                    Customer is here · enter PIN
                  </button>
                  <button
                    type="button"
                    disabled={!canNoShow || loading}
                    onClick={markNoShow}
                    className="h-btn rounded-2xl bg-surface text-ink font-bold text-[14px] disabled:opacity-40"
                  >
                    {canNoShow
                      ? "Customer didn't show"
                      : `Customer didn't show · available in ${noShowMinsLeft}:${noShowSecsDisplay}`}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )
    }

    // R3: Standard drop-off (and gate before arrival)
    return (
      <div className="min-h-screen bg-canvas font-body text-ink flex flex-col">
        <div className="bg-ink flex flex-col" style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
          <Link href="/rider/jobs" className="flex items-center gap-1 px-3 pt-1 pb-0 text-white/60 no-underline w-fit">
            <ArrowLeft size={18} strokeWidth={2} />
            <span className="text-[13px] font-medium">Jobs</span>
          </Link>
          <div className="flex items-start justify-between px-4 pb-1">
            <div>
              <p className="text-[11px] text-white/50 font-medium tracking-wide mb-0.5">{order.code} · Step 2 of 2</p>
              <p className="font-heading font-extrabold text-[20px] text-white leading-tight">Deliver to customer</p>
            </div>
            <span className="mt-1 px-3 py-1.5 rounded-xl bg-brand text-white text-[13px] font-bold shrink-0">
              {formatMoney(order.rider_pay)} this trip
            </span>
          </div>
          <div className="flex gap-1.5 px-4 pb-3 pt-2">
            <div className="flex-1 h-1 rounded-full bg-white/40" />
            <div className="flex-1 h-1 rounded-full bg-white" />
          </div>
        </div>

        <div className="px-4 py-4 flex flex-col gap-3 flex-1">
          {/* Customer delivery card — green border */}
          <div className="bg-white rounded-2xl border-2 border-brand p-4 flex flex-col gap-3">
            <p className="text-[11px] font-bold text-brand tracking-wide uppercase">Deliver to · {customerArea}</p>
            <p className="font-heading font-extrabold text-[18px] text-ink leading-tight">{order.address_landmark}</p>
            {order.address_details && (
              <p className="text-[14px] text-ink-2 -mt-2">{order.address_details}</p>
            )}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-tint flex items-center justify-center shrink-0">
                <span className="font-heading font-bold text-[12px] text-brand-ink">{initials(customerName)}</span>
              </div>
              <div>
                <p className="text-[14px] font-bold text-ink">{nameWithInitial(customerName)}</p>
                <p className="text-[13px] text-ink-2">{order.address_phone}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <a href={`tel:${order.address_phone}`}
                className="flex-1 h-10 rounded-xl bg-brand text-white font-bold text-[13px] flex items-center justify-center gap-1.5 no-underline">
                <Phone size={14} /> Call customer
              </a>
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                className="flex-1 h-10 rounded-xl bg-surface border border-line text-[13px] font-bold text-ink flex items-center justify-center gap-1.5 no-underline">
                <Map size={14} /> Open in Maps
              </a>
            </div>
          </div>

          {/* Show PIN section after arrival, or info card before */}
          {arrivedAt ? (
            <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
              <PinEntry value={pin} onChange={setPin} error={error} />
              {!canNoShow && (
                <p className="text-[12px] text-ink-2 text-center">
                  &quot;Can&apos;t reach customer&quot; unlocks in {noShowMinsLeft}:{noShowSecsDisplay}
                </p>
              )}
            </div>
          ) : (
            <div className="bg-surface rounded-2xl px-4 py-3.5 flex gap-3 items-start">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B6168" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-[13px] text-ink-2 leading-relaxed">
                Tap &quot;I&apos;ve arrived&quot; when you reach the landmark. We&apos;ll tell the customer you&apos;re outside.
              </p>
            </div>
          )}
        </div>

        {!arrivedAt && error && <p className="text-sm text-danger text-center px-4 pb-2">{error}</p>}

        <div className="px-4 pb-5 pt-2 bg-white border-t border-line flex flex-col gap-2"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
          {arrivedAt ? (
            <>
              <button
                type="button"
                disabled={pin.length !== 4 || loading}
                onClick={confirmDelivery}
                className="h-btn rounded-2xl bg-brand text-white font-bold text-base disabled:opacity-50"
              >
                {loading ? 'Verifying…' : 'Confirm delivery'}
              </button>
              {canNoShow && !order.gate_no_show && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={markNoShow}
                  className="h-11 rounded-2xl border-2 border-danger text-danger font-bold text-[14px] bg-white disabled:opacity-50"
                >
                  {loading ? 'Recording…' : "Can't reach customer"}
                </button>
              )}
              {order.gate_no_show && (
                <p className="text-[13px] text-warn text-center font-semibold">No-show recorded — admin will decide</p>
              )}
            </>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={markArrived}
              className="h-btn rounded-2xl bg-ink text-white font-bold text-base disabled:opacity-60"
            >
              {loading ? 'Recording…' : "I've arrived"}
            </button>
          )}
        </div>
      </div>
    )
  }

  // Fallback
  return null
}
