'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Phone, Map } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/format'
import type { Order, OrderItem } from '@/types/database'

type JobOrder = Order & {
  vendors: { name: string; id: string }
  order_items: { name_snapshot: string; qty: number }[]
}

interface Props {
  initialJobs: JobOrder[]
  riderId: string
}

const WAIT_MS = 10 * 60 * 1000

export function RiderJobsClient({ initialJobs, riderId }: Props) {
  const [jobs, setJobs] = useState<JobOrder[]>(initialJobs)
  const [pinInputs, setPinInputs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const supabase = createClient()

  // Clock for gate countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel(`rider:${riderId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `rider_id=eq.${riderId}` },
        payload => {
          if (payload.eventType === 'INSERT') {
            setJobs(prev => [...prev, payload.new as JobOrder])
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as JobOrder
            if (!['ready', 'picked_up'].includes(updated.status)) {
              setJobs(prev => prev.filter(j => j.id !== updated.id))
            } else {
              setJobs(prev => prev.map(j => j.id === updated.id ? { ...j, ...updated } : j))
            }
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [riderId])

  async function api(path: string, body?: object) {
    setLoading(path)
    setError(null)
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json().catch(() => ({}))
    setLoading(null)
    if (!res.ok) setError(json.error ?? 'Failed')
    return res.ok
  }

  async function markPickedUp(orderId: string) {
    await api(`/api/orders/${orderId}/transition`, { toStatus: 'picked_up' })
  }

  async function confirmDelivery(orderId: string) {
    const pin = pinInputs[orderId]?.trim()
    if (!pin || pin.length !== 4) { setError('Enter the 4-digit PIN'); return }
    await api(`/api/orders/${orderId}/transition`, { toStatus: 'delivered', deliveryPin: pin })
  }

  async function markArrived(orderId: string) {
    await api(`/api/orders/${orderId}/gate-arrived`)
  }

  async function markNoShow(orderId: string) {
    await api(`/api/orders/${orderId}/gate-no-show`)
  }

  const pickupJobs = jobs.filter(j => j.status === 'ready')
  const deliveryJobs = jobs.filter(j => j.status === 'picked_up')

  return (
    <div className="min-h-screen bg-canvas font-body text-ink pb-24">
      <header className="bg-white px-5 pt-5 pb-3 border-b border-line">
        <h1 className="font-heading font-extrabold text-xl">My jobs</h1>
      </header>

      <div className="px-4 py-4 flex flex-col gap-4">
        {pickupJobs.length === 0 && deliveryJobs.length === 0 && (
          <p className="text-center text-ink-2 py-16">No active jobs</p>
        )}

        {pickupJobs.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-[13px] font-bold text-ink-2 uppercase tracking-wide">Pick up</h2>
            {pickupJobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                action="pickup"
                loading={loading?.includes(job.id) ?? false}
                onPickup={() => markPickedUp(job.id)}
              />
            ))}
          </section>
        )}

        {deliveryJobs.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-[13px] font-bold text-ink-2 uppercase tracking-wide">Deliver</h2>
            {deliveryJobs.map(job => (
              <div key={job.id} className="flex flex-col gap-2">
                {job.is_gate_pickup ? (
                  <GateCard
                    job={job}
                    now={now}
                    waitMs={WAIT_MS}
                    loading={!!loading?.includes(job.id)}
                    pinValue={pinInputs[job.id] ?? ''}
                    onPinChange={val => setPinInputs(p => ({ ...p, [job.id]: val }))}
                    onArrived={() => markArrived(job.id)}
                    onNoShow={() => markNoShow(job.id)}
                    onDeliver={() => confirmDelivery(job.id)}
                  />
                ) : (
                  <JobCard
                    job={job}
                    action="deliver"
                    loading={!!loading?.includes(job.id)}
                    onDeliver={() => confirmDelivery(job.id)}
                    pinValue={pinInputs[job.id] ?? ''}
                    onPinChange={val => setPinInputs(p => ({ ...p, [job.id]: val }))}
                  />
                )}
                {error && !loading && (
                  <p className="text-sm text-danger px-4">{error}</p>
                )}
              </div>
            ))}
          </section>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 h-[72px] px-3 pb-3.5 pt-2 bg-white border-t border-line grid grid-cols-2">
        <Link href="/rider/jobs" className="flex flex-col items-center justify-center gap-1 text-xs font-bold text-brand no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          Jobs
        </Link>
        <Link href="/rider/earnings" className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-ink-2 no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/></svg>
          Earnings
        </Link>
      </nav>
    </div>
  )
}

// ── Standard job card (pickup + non-gate deliver) ──────────────
function JobCard({
  job, action, loading, onPickup, onDeliver, pinValue, onPinChange,
}: {
  job: JobOrder
  action: 'pickup' | 'deliver'
  loading: boolean
  onPickup?: () => void
  onDeliver?: () => void
  pinValue?: string
  onPinChange?: (val: string) => void
}) {
  return (
    <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <span className="text-base font-bold">{job.code}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          action === 'pickup' ? 'bg-brand-tint text-brand-ink' : 'bg-warn-tint text-warn'
        }`}>
          {action === 'pickup' ? 'Pick up' : 'Deliver'}
        </span>
      </div>

      <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-canvas">
        <span className="text-xs font-semibold text-ink-2">Vendor</span>
        <span className="text-[15px] font-bold">{job.vendors?.name}</span>
        <a href="tel:" className="flex items-center gap-1.5 text-sm text-brand font-semibold mt-1">
          <Phone size={14} /> Call vendor
        </a>
      </div>

      <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-canvas">
        <span className="text-xs font-semibold text-ink-2">Deliver to</span>
        <span className="text-[15px] font-bold">{job.area_name ?? job.address_zone}</span>
        {job.address_landmark && <span className="text-sm text-ink-2">{job.address_landmark}</span>}
        {job.address_details && <span className="text-sm text-ink-2">{job.address_details}</span>}
        <div className="flex items-center gap-3 mt-1">
          <a href={`tel:${job.address_phone}`} className="flex items-center gap-1.5 text-sm text-brand font-semibold">
            <Phone size={14} /> Call customer
          </a>
          {(job.area_name ?? job.address_zone) && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent((job.area_name ?? job.address_zone) + ', Sagamu, Ogun State')}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-brand font-semibold"
            >
              <Map size={14} /> Open in Maps
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {job.order_items.map((oi, i) => (
          <span key={i} className="text-sm">{oi.qty}× {oi.name_snapshot}</span>
        ))}
        <span className="text-[15px] font-bold mt-1">{formatMoney(job.total)}</span>
      </div>

      {action === 'pickup' && (
        <button type="button" disabled={loading} onClick={onPickup}
          className="h-btn rounded-2xl bg-brand text-white font-bold text-base disabled:opacity-50">
          {loading ? 'Confirming…' : 'Picked up from vendor'}
        </button>
      )}

      {action === 'deliver' && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
            Customer PIN (4 digits)
            <input
              type="text" inputMode="numeric" maxLength={4}
              value={pinValue} onChange={e => onPinChange?.(e.target.value.replace(/\D/g, ''))}
              placeholder="0000"
              className="h-btn-sm px-3 rounded-xl border border-line font-body text-xl tracking-[0.5em] text-center"
            />
          </label>
          <button type="button" disabled={loading || !pinValue || pinValue.length < 4} onClick={onDeliver}
            className="h-btn rounded-2xl bg-brand text-white font-bold text-base disabled:opacity-50">
            {loading ? 'Verifying…' : 'Confirm delivery'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Gate pickup card ───────────────────────────────────────────
function GateCard({
  job, now, waitMs, loading, pinValue, onPinChange, onArrived, onNoShow, onDeliver,
}: {
  job: JobOrder
  now: number
  waitMs: number
  loading: boolean
  pinValue: string
  onPinChange: (val: string) => void
  onArrived: () => void
  onNoShow: () => void
  onDeliver: () => void
}) {
  const arrivedAt = job.gate_arrived_at ? new Date(job.gate_arrived_at).getTime() : null
  const elapsed = arrivedAt ? now - arrivedAt : 0
  const canNoShow = !!arrivedAt && elapsed >= waitMs
  const secsLeft = arrivedAt ? Math.max(0, Math.ceil((waitMs - elapsed) / 1000)) : 0
  const minsLeft = Math.floor(secsLeft / 60)
  const secsDisplay = String(secsLeft % 60).padStart(2, '0')

  return (
    <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <span className="text-base font-bold">{job.code}</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-warn-tint text-warn">Gate pickup</span>
      </div>

      <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-canvas">
        <span className="text-xs font-semibold text-ink-2">Vendor</span>
        <span className="text-[15px] font-bold">{job.vendors?.name}</span>
        <a href="tel:" className="flex items-center gap-1.5 text-sm text-brand font-semibold mt-1">
          <Phone size={14} /> Call vendor
        </a>
      </div>

      <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-canvas">
        <span className="text-xs font-semibold text-ink-2">Deliver to gate</span>
        <span className="text-[15px] font-bold">{job.area_name ?? job.address_zone}</span>
        {job.address_landmark && <span className="text-sm text-ink-2">{job.address_landmark}</span>}
      </div>

      {/* State A: not yet arrived */}
      {!arrivedAt && !job.gate_no_show && (
        <button type="button" disabled={loading} onClick={onArrived}
          className="h-btn rounded-2xl bg-brand text-white font-bold text-base disabled:opacity-50">
          {loading ? 'Recording…' : "I've arrived at the gate"}
        </button>
      )}

      {/* State B: arrived, waiting */}
      {arrivedAt && !job.gate_no_show && (
        <>
          <div className="px-3 py-2.5 rounded-xl bg-brand-tint text-[13px] text-brand-ink flex items-center justify-between">
            <span>Waiting for customer</span>
            {!canNoShow && (
              <span className="font-bold tabular-nums">{minsLeft}:{secsDisplay}</span>
            )}
          </div>

          <a href={`tel:${job.address_phone}`}
            className="h-11 rounded-xl bg-surface flex items-center justify-center gap-2 text-[14px] font-bold text-brand">
            <Phone size={16} />
            Call customer — {job.address_phone}
          </a>

          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
              Customer PIN (4 digits)
              <input
                type="text" inputMode="numeric" maxLength={4}
                value={pinValue} onChange={e => onPinChange(e.target.value.replace(/\D/g, ''))}
                placeholder="0000"
                className="h-btn-sm px-3 rounded-xl border border-line font-body text-xl tracking-[0.5em] text-center"
              />
            </label>
            <button type="button" disabled={loading || pinValue.length < 4} onClick={onDeliver}
              className="h-btn rounded-2xl bg-brand text-white font-bold text-base disabled:opacity-50">
              {loading ? 'Verifying…' : 'Confirm delivery'}
            </button>
          </div>

          {canNoShow && (
            <button type="button" disabled={loading} onClick={onNoShow}
              className="h-11 rounded-xl border-2 border-danger text-danger font-bold text-[14px] disabled:opacity-50">
              {loading ? 'Recording…' : 'Customer did not show'}
            </button>
          )}
        </>
      )}

      {/* State C: no-show recorded */}
      {job.gate_no_show && (
        <div className="px-3 py-2.5 rounded-xl bg-warn-tint text-[13px] text-warn text-center font-semibold">
          No-show recorded — admin will decide on refund
        </div>
      )}
    </div>
  )
}
