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

export function RiderJobsClient({ initialJobs, riderId }: Props) {
  const [jobs, setJobs] = useState<JobOrder[]>(initialJobs)
  const [pinInputs, setPinInputs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel(`rider:${riderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `rider_id=eq.${riderId}`,
        },
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

  async function markPickedUp(orderId: string) {
    setLoading(orderId)
    setError(null)
    await fetch(`/api/orders/${orderId}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toStatus: 'picked_up' }),
    })
    setLoading(null)
  }

  async function confirmDelivery(orderId: string) {
    const pin = pinInputs[orderId]?.trim()
    if (!pin || pin.length !== 4) {
      setError('Enter the 4-digit PIN')
      return
    }
    setLoading(orderId)
    setError(null)
    const res = await fetch(`/api/orders/${orderId}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toStatus: 'delivered', deliveryPin: pin }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Failed')
    }
    setLoading(null)
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
                loading={loading === job.id}
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
                <JobCard
                  job={job}
                  action="deliver"
                  loading={loading === job.id}
                  onDeliver={() => confirmDelivery(job.id)}
                  pinValue={pinInputs[job.id] ?? ''}
                  onPinChange={val => setPinInputs(p => ({ ...p, [job.id]: val }))}
                />
                {error && loading !== job.id && (
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

function JobCard({
  job,
  action,
  loading,
  onPickup,
  onDeliver,
  pinValue,
  onPinChange,
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

      {/* Vendor */}
      <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-canvas">
        <span className="text-xs font-semibold text-ink-2">Vendor</span>
        <span className="text-[15px] font-bold">{job.vendors?.name}</span>
        <div className="flex items-center gap-2 mt-1">
          <a href={`tel:`} className="flex items-center gap-1.5 text-sm text-brand font-semibold">
            <Phone size={14} />
            Call vendor
          </a>
        </div>
      </div>

      {/* Customer */}
      <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-canvas">
        <span className="text-xs font-semibold text-ink-2">Deliver to</span>
        <span className="text-[15px] font-bold">{job.area_name ?? job.address_zone}</span>
        <span className="text-sm text-ink-2">{job.address_landmark}</span>
        {job.address_details && (
          <span className="text-sm text-ink-2">{job.address_details}</span>
        )}
        <div className="flex items-center gap-3 mt-1">
          <a href={`tel:${job.address_phone}`} className="flex items-center gap-1.5 text-sm text-brand font-semibold">
            <Phone size={14} />
            Call customer
          </a>
          {(job.area_name ?? job.address_zone) && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent((job.area_name ?? job.address_zone) + ', Sagamu, Ogun State')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-brand font-semibold"
            >
              <Map size={14} />
              Open in Maps
            </a>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="flex flex-col gap-1">
        {job.order_items.map((oi, i) => (
          <span key={i} className="text-sm">
            {oi.qty}× {oi.name_snapshot}
          </span>
        ))}
        <span className="text-[15px] font-bold mt-1">{formatMoney(job.total)}</span>
      </div>

      {/* Action */}
      {action === 'pickup' && (
        <button
          type="button"
          disabled={loading}
          onClick={onPickup}
          className="h-btn rounded-2xl bg-brand text-white font-bold text-base disabled:opacity-50"
        >
          {loading ? 'Confirming…' : 'Picked up from vendor'}
        </button>
      )}

      {action === 'deliver' && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
            Customer PIN (4 digits)
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={pinValue}
              onChange={e => onPinChange?.(e.target.value.replace(/\D/g, ''))}
              placeholder="0000"
              className="h-btn-sm px-3 rounded-xl border border-line font-body text-xl tracking-[0.5em] text-center"
            />
          </label>
          <button
            type="button"
            disabled={loading || !pinValue || pinValue.length < 4}
            onClick={onDeliver}
            className="h-btn rounded-2xl bg-brand text-white font-bold text-base disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Confirm delivery'}
          </button>
        </div>
      )}
    </div>
  )
}
