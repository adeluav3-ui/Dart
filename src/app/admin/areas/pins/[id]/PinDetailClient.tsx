'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Navigation, RotateCcw, ExternalLink, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { Area, AreaPinHistory } from '@/types/database'

interface Props {
  initialArea: Area
  initialHistory: AreaPinHistory[]
  correctionRate: number
  correctionTotal: number
  userId: string | null
}

type LocPhase = 'idle' | 'watching' | 'timeout'
interface GpsReading { lat: number; lng: number; accuracy: number }
interface PendingSave { lat: number; lng: number; accuracy_m: number | null; source: 'gps' | 'paste' }

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

function fmtCoord(n: number) { return n.toFixed(6) }

function relDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

export function PinDetailClient({ initialArea, initialHistory, correctionRate, correctionTotal, userId }: Props) {
  const [area, setArea] = useState<Area>(initialArea)
  const [history, setHistory] = useState<AreaPinHistory[]>(initialHistory)
  const [locPhase, setLocPhase] = useState<LocPhase>('idle')
  const [gps, setGps] = useState<GpsReading | null>(null)
  const [confirmPending, setConfirmPending] = useState<PendingSave | null>(null)
  const [pasteValue, setPasteValue] = useState('')
  const [pasteError, setPasteError] = useState('')
  const [saving, setSaving] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [flashSaved, setFlashSaved] = useState(false)
  const watchIdRef = useRef<number | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => stopLocating(), [])

  function stopLocating() {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (timeoutRef.current != null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  function startLocating() {
    if (!navigator.geolocation) return
    stopLocating()
    setLocPhase('watching')
    setGps(null)

    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords
        setGps({ lat, lng, accuracy })
        if (accuracy <= 30) {
          stopLocating()
          setLocPhase('idle')
          setConfirmPending({ lat, lng, accuracy_m: accuracy, source: 'gps' })
        }
      },
      () => { stopLocating(); setLocPhase('timeout') },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    )

    timeoutRef.current = setTimeout(() => {
      stopLocating()
      setLocPhase(prev => prev === 'watching' ? 'timeout' : prev)
    }, 20000)
  }

  function handlePasteSubmit() {
    const m = pasteValue.trim().match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/)
    if (!m) { setPasteError('Format: 6.8312, 3.6421'); return }
    const lat = parseFloat(m[1])
    const lng = parseFloat(m[2])
    if (lat < -90 || lat > 90) { setPasteError('Latitude must be between -90 and 90'); return }
    if (lng < -180 || lng > 180) { setPasteError('Longitude must be between -180 and 180'); return }
    setPasteError('')
    setConfirmPending({ lat, lng, accuracy_m: null, source: 'paste' })
  }

  async function savePin(pending: PendingSave) {
    setSaving(true)
    const res = await fetch(`/api/admin/areas/${area.id}/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: pending.lat, lng: pending.lng, accuracy_m: pending.accuracy_m }),
    })
    setSaving(false)
    if (!res.ok) return

    // Archive current pin locally
    if (area.lat != null && area.lng != null) {
      setHistory(prev => [{
        id: crypto.randomUUID(),
        area_id: area.id,
        lat: area.lat!,
        lng: area.lng!,
        accuracy_m: area.accuracy_m,
        saved_at: area.pin_saved_at ?? new Date().toISOString(),
        saved_by: area.pin_saved_by,
        replaced_at: new Date().toISOString(),
      }, ...prev.slice(0, 2)])
    }

    setArea(a => ({
      ...a,
      lat: pending.lat,
      lng: pending.lng,
      accuracy_m: pending.accuracy_m,
      pin_saved_at: new Date().toISOString(),
      pin_saved_by: userId,
    }))
    setConfirmPending(null)
    setPasteValue('')
    setFlashSaved(true)
    setTimeout(() => { window.location.href = '/admin/areas/pins' }, 1500)
  }

  async function restorePin() {
    if (!history[0]) return
    setRestoring(true)
    const res = await fetch(`/api/admin/areas/${area.id}/pin/restore`, { method: 'POST' })
    setRestoring(false)
    if (!res.ok) return
    setFlashSaved(true)
    setTimeout(() => { window.location.href = '/admin/areas/pins' }, 1500)
  }

  const hasPin = area.lat != null && area.lng != null

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-4 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <a href="/admin/areas/pins" aria-label="Back" className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-line">
          <ArrowLeft size={18} />
        </a>
        <div>
          <h2 className="font-heading font-bold text-xl leading-tight">{area.name}</h2>
          <span className={`text-[13px] font-semibold ${hasPin ? 'text-brand' : 'text-[#F59E0B]'}`}>
            {hasPin ? 'Pin set' : 'No pin'}
          </span>
        </div>
      </div>

      {/* Flash saved */}
      {flashSaved && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-brand-tint text-brand font-semibold text-sm">
          <CheckCircle2 size={16} />
          Pin saved
        </div>
      )}

      {/* Correction rate warning */}
      {correctionTotal >= 5 && correctionRate > 0.2 && (
        <div className="px-4 py-3 rounded-2xl bg-warn-tint border border-warn/20 text-sm text-warn font-semibold">
          ⚠ Customers often correct this area ({Math.round(correctionRate * 100)}% of {correctionTotal} detections). Check the pin is in the right spot.
        </div>
      )}
      {correctionTotal >= 5 && correctionRate <= 0.2 && (
        <p className="text-[13px] text-ink-2 px-1">
          Location detection accuracy: {Math.round((1 - correctionRate) * 100)}% ({correctionTotal} detections)
        </p>
      )}

      {/* Current pin */}
      {hasPin && (
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
          <h3 className="text-[13px] font-bold text-ink-2 uppercase tracking-wide">Current pin</h3>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[15px] font-semibold">
                {fmtCoord(area.lat!)}, {fmtCoord(area.lng!)}
              </span>
              <span className="text-[13px] text-ink-2">
                {area.accuracy_m != null ? `${Math.round(area.accuracy_m)}m accuracy` : 'Manual entry'}
                {area.pin_saved_at ? ` · ${relDate(area.pin_saved_at)}` : ''}
              </span>
            </div>
            <a
              href={mapsUrl(area.lat!, area.lng!)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[13px] font-semibold text-brand no-underline shrink-0"
            >
              <ExternalLink size={14} />
              Maps
            </a>
          </div>
          {history.length > 0 && (
            <button
              type="button"
              onClick={restorePin}
              disabled={restoring}
              className="flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink disabled:opacity-50 bg-transparent border-0 cursor-pointer p-0 self-start"
            >
              <RotateCcw size={13} />
              {restoring ? 'Restoring…' : `Restore previous pin (${fmtCoord(history[0].lat)}, ${fmtCoord(history[0].lng)})`}
            </button>
          )}
        </div>
      )}

      {/* GPS capture */}
      <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
        <h3 className="text-[13px] font-bold text-ink-2 uppercase tracking-wide">
          {hasPin ? 'Update pin' : 'Set pin'}
        </h3>
        <p className="text-[13px] text-ink-2">Stand at the centre of <strong>{area.name}</strong>, then tap the button below.</p>

        {locPhase === 'idle' && (
          <button
            type="button"
            onClick={startLocating}
            className="h-14 w-full rounded-2xl bg-brand text-white font-heading font-bold text-[17px] flex items-center justify-center gap-3 active:bg-brand-dark"
          >
            <Navigation size={20} />
            Save my current location
          </button>
        )}

        {locPhase === 'watching' && (
          <div className="flex flex-col gap-3">
            <div className="h-14 w-full rounded-2xl bg-brand-tint border border-brand/30 flex flex-col items-center justify-center">
              <span className="text-[13px] font-semibold text-brand-ink">
                {gps
                  ? `Accuracy: ${Math.round(gps.accuracy)}m ${gps.accuracy <= 30 ? '✓' : '— waiting for better signal'}`
                  : 'Getting location…'}
              </span>
              {gps && gps.accuracy > 30 && (
                <span className="text-[12px] text-ink-2 mt-0.5">Step outside or away from buildings</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => { stopLocating(); setLocPhase('idle'); setGps(null) }}
              className="text-[14px] font-semibold text-ink-2 text-center bg-transparent border-0 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {locPhase === 'timeout' && (
          <div className="flex flex-col gap-3">
            <div className="px-4 py-3 rounded-2xl bg-surface text-[13px] text-ink-2 text-center">
              {gps
                ? `Accuracy only ${Math.round(gps.accuracy)}m after 20 s. Step outside or away from buildings.`
                : 'Could not get location. Make sure location is enabled.'}
            </div>
            <button
              type="button"
              onClick={startLocating}
              className="h-12 w-full rounded-2xl bg-brand text-white font-semibold flex items-center justify-center gap-2"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {/* Paste coordinates */}
      <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
        <h3 className="text-[13px] font-bold text-ink-2 uppercase tracking-wide">Paste coordinates</h3>
        <p className="text-[13px] text-ink-2">Copy from Google Maps and paste here — format: <span className="font-mono">6.8312, 3.6421</span></p>
        <div className="flex gap-2">
          <input
            type="text"
            value={pasteValue}
            onChange={e => { setPasteValue(e.target.value); setPasteError('') }}
            placeholder="6.8726, 3.6532"
            className="flex-1 h-12 px-3 rounded-xl border border-line font-mono text-[15px] text-ink"
            onKeyDown={e => e.key === 'Enter' && handlePasteSubmit()}
          />
          <button
            type="button"
            onClick={handlePasteSubmit}
            disabled={!pasteValue.trim()}
            className="h-12 px-4 rounded-xl bg-brand text-white font-semibold text-[14px] disabled:opacity-40"
          >
            Preview
          </button>
        </div>
        {pasteError && <p className="text-[13px] text-danger">{pasteError}</p>}
      </div>

      {/* Confirm sheet */}
      {confirmPending && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setConfirmPending(null)} />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl p-6 flex flex-col gap-4 max-w-md mx-auto"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
            <h3 className="font-heading font-bold text-xl">Save this spot as the {area.name} pin?</h3>

            <div className="flex flex-col gap-1">
              <span className="font-mono text-[17px] font-bold">
                {fmtCoord(confirmPending.lat)}, {fmtCoord(confirmPending.lng)}
              </span>
              <span className="text-[13px] text-ink-2">
                {confirmPending.accuracy_m != null
                  ? `GPS accuracy: ${Math.round(confirmPending.accuracy_m)}m`
                  : 'Manually entered coordinates'}
              </span>
            </div>

            <a
              href={mapsUrl(confirmPending.lat, confirmPending.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[14px] font-semibold text-brand no-underline"
            >
              <ExternalLink size={15} />
              Open in Google Maps to verify
            </a>

            <div className="flex flex-col gap-2 pt-1">
              <Button onClick={() => savePin(confirmPending)} loading={saving} fullWidth size="lg">
                Save pin
              </Button>
              <button
                type="button"
                onClick={() => setConfirmPending(null)}
                className="h-12 text-[15px] font-semibold text-ink-2 bg-transparent border-0 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
