'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatMoney, formatTime } from '@/lib/format'
import { formatLocationAge, STALE_MS } from '@/lib/geo'
import { RiderBottomNav } from '@/components/rider/RiderBottomNav'

interface JobOrder {
  id: string
  code: string
  status: string
  area_name: string | null
  address_zone: string
  rider_pay: number
  vendors: { name: string } | null
}

interface Props {
  riderId: string
  firstName: string
  todayAmount: number
  todayTrips: number
  initialAvailable: boolean
  locationUpdatedAt: string | null
  nearestArea: string | null
  initialJobs: JobOrder[]
}

const LOCATION_REFRESH_MS = 2 * 60 * 1000

export function RiderJobsClient({
  riderId, firstName, todayAmount, todayTrips,
  initialAvailable, locationUpdatedAt, nearestArea: initialNearestArea,
  initialJobs,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [available, setAvailable] = useState(initialAvailable)
  const [availLoading, setAvailLoading] = useState(false)
  const [availError, setAvailError] = useState('')
  const [locUpdatedAt, setLocUpdatedAt] = useState<string | null>(locationUpdatedAt)
  const [nearestArea, setNearestArea] = useState<string | null>(initialNearestArea)
  const [jobs, setJobs] = useState<JobOrder[]>(initialJobs)
  const [, forceRender] = useState(0)

  const supabaseRef = useRef(supabase)

  const isStale = available && locUpdatedAt &&
    (Date.now() - new Date(locUpdatedAt).getTime()) > STALE_MS

  // Clock tick for location age
  useEffect(() => {
    const t = setInterval(() => forceRender(n => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  // Realtime: new job assigned or status changes
  useEffect(() => {
    const client = supabaseRef.current
    const channel = client
      .channel(`rider-jobs:${riderId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `rider_id=eq.${riderId}` },
        payload => {
          if (payload.eventType === 'INSERT') {
            setJobs(prev => [...prev, payload.new as JobOrder])
            navigator.vibrate?.([200, 100, 200])
          } else if (payload.eventType === 'UPDATE') {
            const u = payload.new as JobOrder
            if (!['accepted', 'ready', 'picked_up'].includes(u.status)) {
              setJobs(prev => prev.filter(j => j.id !== u.id))
            } else {
              setJobs(prev => prev.map(j => j.id === u.id ? { ...j, ...u } : j))
            }
          }
        }
      )
      .subscribe()
    return () => { client.removeChannel(channel) }
  }, [riderId])

  // Background location refresh every 2 min while available
  useEffect(() => {
    if (!available) return
    const interval = setInterval(() => {
      navigator.geolocation?.getCurrentPosition(pos => {
        fetch('/api/rider/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            available: true,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }),
        }).then(() => {
          setLocUpdatedAt(new Date().toISOString())
        }).catch(() => {})
      })
    }, LOCATION_REFRESH_MS)
    return () => clearInterval(interval)
  }, [available])

  async function goAvailable() {
    if (!navigator.geolocation) {
      setAvailError('Geolocation is not supported by your browser')
      return
    }
    setAvailLoading(true)
    setAvailError('')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const res = await fetch('/api/rider/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            available: true,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }),
        })
        setAvailLoading(false)
        if (res.ok) {
          setAvailable(true)
          const now = new Date().toISOString()
          setLocUpdatedAt(now)
          // Find nearest area client-side (approximate)
        } else {
          const j = await res.json().catch(() => ({}))
          setAvailError(j.error ?? 'Could not update')
        }
      },
      err => {
        setAvailLoading(false)
        setAvailError(
          err.code === 1
            ? 'Location permission denied. Enable it in your browser settings.'
            : 'Could not get your location. Try again.'
        )
      },
      { timeout: 10_000 }
    )
  }

  async function goOffline() {
    setAvailLoading(true)
    const res = await fetch('/api/rider/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: false }),
    })
    setAvailLoading(false)
    if (res.ok) setAvailable(false)
    else setAvailError('Could not update')
  }

  async function refreshLocation() {
    if (!navigator.geolocation) return
    setAvailLoading(true)
    navigator.geolocation.getCurrentPosition(async pos => {
      await fetch('/api/rider/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          available: true,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      })
      setLocUpdatedAt(new Date().toISOString())
      setAvailLoading(false)
    }, () => setAvailLoading(false), { timeout: 10_000 })
  }

  return (
    <div className="min-h-screen bg-canvas font-body text-ink"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}>

      {/* Dark header */}
      <header
        className="bg-ink px-5 pb-4 flex items-end justify-between"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}
      >
        <div>
          <p className="text-[11px] text-white/50 font-medium tracking-wide uppercase mb-0.5">Dart rider</p>
          <p className="font-heading font-extrabold text-[22px] text-white leading-tight">Hi, {firstName}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-white/50 font-medium tracking-wide uppercase mb-0.5">Today</p>
          <p className="text-[15px] font-bold text-white">{formatMoney(todayAmount)} · {todayTrips} {todayTrips === 1 ? 'trip' : 'trips'}</p>
        </div>
      </header>

      <div className="px-4 pt-4 flex flex-col gap-3">

        {/* Availability card */}
        <div
          className={`rounded-2xl p-5 flex flex-col items-center gap-3 transition-colors ${available ? 'bg-brand' : 'bg-white'}`}
        >
          {/* Toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={available}
            disabled={availLoading}
            onClick={available ? goOffline : goAvailable}
            className={`relative w-16 h-8 rounded-full border-0 cursor-pointer transition-colors shrink-0 disabled:opacity-60 ${available ? 'bg-white/30' : 'bg-[#C3C8CD]'}`}
          >
            <span className={`absolute top-1 w-6 h-6 rounded-full shadow transition-all ${available ? 'bg-white left-9' : 'bg-white left-1'}`} />
          </button>

          {available ? (
            <>
              <p className="font-heading font-extrabold text-[26px] text-white leading-tight">I&apos;m available</p>
              <p className="text-[14px] text-white/80 text-center">Nearby vendors can see you and call you for jobs.</p>
            </>
          ) : (
            <>
              <p className="font-heading font-extrabold text-[22px] text-ink leading-tight">I&apos;m not available</p>
              <p className="text-[13px] text-ink-2 text-center">Go available to receive job assignments.</p>
            </>
          )}
          {availLoading && <p className="text-[13px] text-white/70">Updating…</p>}
          {availError && <p className="text-[13px] text-danger bg-white/90 rounded-xl px-3 py-1.5 text-center">{availError}</p>}
        </div>

        {/* When available: location + warning */}
        {available && (
          <>
            {/* Location card */}
            <div className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B7A47" strokeWidth="2" strokeLinecap="round" className="shrink-0">
                <path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z"/><circle cx="12" cy="9" r="2.5"/>
              </svg>
              <div className="flex-1 min-w-0">
                {nearestArea && <p className="text-[14px] font-bold text-ink">Near {nearestArea}</p>}
                <p className="text-[12px] text-ink-2">
                  Location updated {locUpdatedAt ? formatLocationAge(locUpdatedAt) : 'never'}
                  {' · '}keeps updating while Dart is open
                </p>
                {isStale && (
                  <p className="text-[12px] text-danger font-semibold mt-0.5">Location is stale — tap Refresh</p>
                )}
              </div>
              <button
                type="button"
                onClick={refreshLocation}
                disabled={availLoading}
                className="h-8 px-3 rounded-lg border border-line text-[12px] font-bold text-ink bg-white shrink-0 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>

            {/* Amber tip */}
            <div className="bg-warn-tint rounded-2xl px-4 py-3.5 flex gap-3 items-start">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A4B08" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-[13px] text-warn leading-relaxed">
                Vendors will <strong>call you</strong> before giving you a job. Keep your phone on and loud. If Dart stays closed for 30 minutes, you&apos;ll go offline automatically.
              </p>
            </div>
          </>
        )}

        {/* When not available: how it works */}
        {!available && (
          <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
            <p className="text-[13px] font-bold text-ink-2 uppercase tracking-wide">How Dart jobs work</p>
            {[
              { n: '1', text: 'A vendor calls you to offer a job' },
              { n: '2', text: 'They assign the order to you on their board' },
              { n: '3', text: 'You pick it up from the vendor and go to the customer' },
              { n: '4', text: 'Confirm delivery with the customer\'s 4-digit PIN' },
            ].map(step => (
              <div key={step.n} className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-surface flex items-center justify-center text-[13px] font-bold text-ink-2 shrink-0">{step.n}</span>
                <span className="text-[14px] text-ink">{step.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Current job(s) */}
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-bold text-ink-2 uppercase tracking-wide px-1">Current job</p>
          {jobs.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-line p-6 flex flex-col items-center gap-1 text-center">
              <p className="text-[15px] font-bold text-ink">No job right now</p>
              <p className="text-[13px] text-ink-2">When a vendor assigns you, it shows up here.</p>
            </div>
          ) : (
            jobs.map(job => (
              <button
                key={job.id}
                type="button"
                onClick={() => router.push(`/rider/job/${job.id}`)}
                className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left w-full"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-[15px] font-bold text-ink">{job.code}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      job.status === 'ready' ? 'bg-brand-tint text-brand-ink'
                      : job.status === 'picked_up' ? 'bg-warn-tint text-warn'
                      : 'bg-surface text-ink-2'
                    }`}>
                      {job.status === 'accepted' ? 'Preparing' : job.status === 'ready' ? 'Ready' : 'On the way'}
                    </span>
                  </div>
                  <p className="text-[13px] text-ink-2">
                    {job.vendors?.name} → {job.area_name ?? job.address_zone}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className="text-[15px] font-bold text-brand">{formatMoney(job.rider_pay)}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B6168" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <RiderBottomNav />
    </div>
  )
}
