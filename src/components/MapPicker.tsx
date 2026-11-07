'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import { X, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { findCoveringArea } from '@/lib/coverageCircles'
import { createClient } from '@/lib/supabase/client'
import type { Area, DeliverySpot, DeliverySpotLabel } from '@/types/database'

interface Props {
  initialLat?: number
  initialLng?: number
  onConfirm: (lat: number, lng: number, areaName: string, description?: string) => void
  onClose: () => void
  coverageAreas?: unknown[]  // kept for signature compatibility — not used
  areas?: Area[]
  userId?: string | null
}

// OOUTH Main Gate, Sagamu
const DEFAULT_LAT = 6.7073
const DEFAULT_LNG = 3.8858

const SPOT_LABELS: DeliverySpotLabel[] = ['Home', 'Hostel', 'Work', 'Other']

export function MapPicker({ initialLat, initialLng, onConfirm, onClose, areas, userId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const accuracyCircleRef = useRef<any>(null)

  const [center, setCenter] = useState({
    lat: initialLat ?? DEFAULT_LAT,
    lng: initialLng ?? DEFAULT_LNG,
  })
  const [coveringArea, setCoveringArea] = useState<Area | null>(() =>
    areas && initialLat != null
      ? findCoveringArea(initialLat, initialLng!, areas)
      : null
  )
  const [locating, setLocating] = useState(false)
  const [autoLocating, setAutoLocating] = useState(initialLat == null)
  const [autoLocateError, setAutoLocateError] = useState('')

  // Waitlist panel (shown when user confirms outside all circles)
  const [showWaitlist, setShowWaitlist] = useState(false)
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistSaving, setWaitlistSaving] = useState(false)
  const [waitlistSent, setWaitlistSent] = useState(false)

  // Description field
  const [description, setDescription] = useState('')

  // Saved spots
  const [savedSpots, setSavedSpots] = useState<DeliverySpot[]>([])
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [savingSpot, setSavingSpot] = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState<{ lat: number; lng: number; areaName: string } | null>(null)

  const areasRef = useRef(areas)
  useEffect(() => { areasRef.current = areas }, [areas])

  // Load saved spots for logged-in user
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    supabase
      .from('delivery_spots')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setSavedSpots(data as DeliverySpot[]) })
  }, [userId])

  useEffect(() => {
    if (!containerRef.current) return
    let mounted = true

    async function initMap() {
      const L = (await import('leaflet')).default
      if (!mounted || !containerRef.current) return

      const map = L.map(containerRef.current, {
        center: [initialLat ?? DEFAULT_LAT, initialLng ?? DEFAULT_LNG],
        zoom: 17,
        zoomControl: false,
      })

      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      const tileUrl = mapboxToken
        ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      const attribution = mapboxToken
        ? '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        : '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

      L.tileLayer(tileUrl, { attribution, maxZoom: 22, tileSize: 512, zoomOffset: -1 }).addTo(map)
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      map.on('move', () => {
        if (!mounted) return
        const { lat, lng } = map.getCenter()
        setCenter({ lat, lng })
        setShowWaitlist(false)
        // Remove accuracy circle once user manually moves the map
        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.remove()
          accuracyCircleRef.current = null
        }
        if (areasRef.current && areasRef.current.length > 0) {
          setCoveringArea(findCoveringArea(lat, lng, areasRef.current))
        }
      })

      mapRef.current = map

      if (initialLat == null) {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            pos => {
              if (!mounted) return
              map.setView([pos.coords.latitude, pos.coords.longitude], 17)
              if (pos.coords.accuracy > 100) {
                accuracyCircleRef.current = L.circle(
                  [pos.coords.latitude, pos.coords.longitude],
                  { radius: pos.coords.accuracy, color: '#0B7A47', fillColor: '#0B7A47', fillOpacity: 0.08, weight: 1.5 }
                ).addTo(map)
              }
              setAutoLocating(false)
            },
            () => {
              if (!mounted) return
              setAutoLocating(false)
              setAutoLocateError("Couldn't detect your location — drag the map to your spot")
            },
            { timeout: 10000, enableHighAccuracy: true }
          )
        } else {
          setAutoLocating(false)
        }
      }
    }

    initMap()

    return () => {
      mounted = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function locateMe() {
    if (!navigator.geolocation || !mapRef.current) return
    setLocating(true)
    setAutoLocateError('')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const L = (await import('leaflet')).default
        if (mapRef.current) {
          mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 17)
          // Draw accuracy circle if imprecise
          if (accuracyCircleRef.current) {
            accuracyCircleRef.current.remove()
            accuracyCircleRef.current = null
          }
          if (pos.coords.accuracy > 100) {
            accuracyCircleRef.current = L.circle(
              [pos.coords.latitude, pos.coords.longitude],
              {
                radius: pos.coords.accuracy,
                color: '#0B7A47',
                fillColor: '#0B7A47',
                fillOpacity: 0.08,
                weight: 1.5,
              }
            ).addTo(mapRef.current)
          }
        }
        setLocating(false)
      },
      () => setLocating(false),
      { timeout: 8000, enableHighAccuracy: true }
    )
  }

  // Move map to a saved spot
  function jumpToSpot(spot: DeliverySpot) {
    if (mapRef.current) {
      mapRef.current.setView([spot.lat, spot.lng], 17)
    }
  }

  async function submitWaitlist() {
    setWaitlistSaving(true)
    const supabase = createClient()
    await supabase.from('coverage_waitlist').insert({
      email: waitlistEmail.trim() || null,
      lat: center.lat,
      lng: center.lng,
      user_id: userId ?? null,
    })
    setWaitlistSaving(false)
    setWaitlistSent(true)
  }

  async function saveSpotAndConfirm(label: DeliverySpotLabel) {
    if (!pendingConfirm || !userId) return
    setSavingSpot(true)
    const supabase = createClient()
    await supabase.from('delivery_spots').insert({
      user_id: userId,
      label,
      lat: pendingConfirm.lat,
      lng: pendingConfirm.lng,
      area_id: coveringArea?.id ?? null,
      description: description.trim() || null,
      is_default: savedSpots.length === 0,
    })
    setSavingSpot(false)
    setShowSavePrompt(false)
    onConfirm(pendingConfirm.lat, pendingConfirm.lng, pendingConfirm.areaName, description.trim() || undefined)
  }

  function handleConfirm() {
    const covering = findCoveringArea(center.lat, center.lng, areas ?? [])
    if (!covering) {
      setShowWaitlist(true)
      return
    }
    const areaName = covering.name
    if (userId && description.trim()) {
      setPendingConfirm({ lat: center.lat, lng: center.lng, areaName })
      setShowSavePrompt(true)
      return
    }
    onConfirm(center.lat, center.lng, areaName, description.trim() || undefined)
  }

  const isOutside = !findCoveringArea(center.lat, center.lng, areas ?? [])

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-surface"
        >
          <X size={16} />
        </button>
        <span className="font-heading font-bold text-[16px]">Confirm your delivery spot</span>
      </div>

      {/* Saved spots chips */}
      {savedSpots.length > 0 && (
        <div className="px-4 pt-3 pb-1 shrink-0 flex gap-2 overflow-x-auto scrollbar-hide">
          {savedSpots.map(spot => (
            <button
              key={spot.id}
              type="button"
              onClick={() => jumpToSpot(spot)}
              className="flex-none h-8 px-3 rounded-full bg-surface border border-line text-[13px] font-semibold text-ink whitespace-nowrap"
            >
              {spot.label === 'Other' && spot.custom_label ? spot.custom_label : spot.label}
            </button>
          ))}
        </div>
      )}

      {/* Map area */}
      <div className="relative flex-1">
        <div ref={containerRef} className="absolute inset-0" />

        {/* Auto-locating overlay */}
        {autoLocating && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90">
            <span className="w-8 h-8 rounded-full border-[3px] border-brand/20 border-t-brand animate-spin mb-3" />
            <p className="text-[15px] font-semibold text-ink">Finding your location…</p>
            <p className="text-[13px] text-ink-2 mt-1">Allow location access when prompted</p>
          </div>
        )}

        {/* Fixed centre pin */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1000 }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 22, height: 11,
            borderRadius: 9999,
            background: 'rgba(0,0,0,0.22)',
            filter: 'blur(3px)',
          }} />
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -100%)',
            filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.4))',
          }}>
            <svg width="36" height="50" viewBox="0 0 36 50" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 0C8.059 0 0 8.059 0 18C0 30 18 50 18 50C18 50 36 30 36 18C36 8.059 27.941 0 18 0Z" fill="#0B7A47"/>
              <circle cx="18" cy="18" r="7" fill="white"/>
            </svg>
          </div>
        </div>

        {/* Re-locate button */}
        {!autoLocating && (
          <button
            type="button"
            onClick={locateMe}
            disabled={locating}
            className="absolute top-3 right-3 w-11 h-11 rounded-full bg-white shadow-md flex items-center justify-center border border-line disabled:opacity-60"
            aria-label="Re-centre on my location"
            style={{ zIndex: 1001 }}
          >
            {locating
              ? <span className="w-4 h-4 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
              : <Navigation size={18} stroke="#0B7A47" />}
          </button>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 pt-3 pb-5 border-t border-line shrink-0 flex flex-col gap-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
      >
        {/* Area label */}
        {coveringArea ? (
          <div className="flex items-center justify-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 36 50" fill="none">
              <path d="M18 0C8.059 0 0 8.059 0 18C0 30 18 50 18 50C18 50 36 30 36 18C36 8.059 27.941 0 18 0Z" fill="#0B7A47"/>
            </svg>
            <span className="text-[14px] font-semibold text-ink">{coveringArea.name}</span>
          </div>
        ) : null}

        <p className="text-[13px] text-ink-2 text-center leading-snug">
          {autoLocateError
            ? autoLocateError
            : 'Drag the map so the pin is on your exact spot, then confirm.'}
        </p>

        {/* Description field */}
        <input
          type="text"
          placeholder="Describe the spot — gate colour, landmark nearby…"
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="h-10 px-3 rounded-xl border border-line font-body text-[14px] text-ink bg-white placeholder:text-ink-2/60 outline-none focus:border-brand transition-colors"
        />

        {/* Waitlist panel */}
        {showWaitlist && !waitlistSent && (
          <div className="flex flex-col gap-2 p-3 rounded-2xl bg-warn-tint">
            <p className="text-[13px] font-semibold text-warn text-center">
              This spot is outside our delivery area
            </p>
            <input
              type="email"
              placeholder="Email for updates (optional)"
              value={waitlistEmail}
              onChange={e => setWaitlistEmail(e.target.value)}
              className="h-10 px-3 rounded-xl border border-line font-body text-[14px] text-ink bg-white"
            />
            <Button onClick={submitWaitlist} loading={waitlistSaving} fullWidth size="sm">
              Notify me when available
            </Button>
          </div>
        )}
        {showWaitlist && waitlistSent && (
          <div className="px-3 py-2.5 rounded-2xl bg-brand-tint text-brand-ink text-[13px] font-medium text-center">
            Got it! We&apos;ll let you know when we expand there.
          </div>
        )}

        {/* Save spot prompt */}
        {showSavePrompt && (
          <div className="flex flex-col gap-2 p-3 rounded-2xl bg-surface">
            <p className="text-[13px] font-semibold text-ink text-center">Save this spot as…</p>
            <div className="flex gap-2 flex-wrap justify-center">
              {SPOT_LABELS.map(label => (
                <button
                  key={label}
                  type="button"
                  disabled={savingSpot}
                  onClick={() => saveSpotAndConfirm(label)}
                  className="h-9 px-4 rounded-full border border-line bg-white font-semibold text-[13px] text-ink disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setShowSavePrompt(false)
                if (pendingConfirm) {
                  onConfirm(pendingConfirm.lat, pendingConfirm.lng, pendingConfirm.areaName, description.trim() || undefined)
                }
              }}
              className="text-[13px] text-ink-2 text-center"
            >
              Skip, don&apos;t save
            </button>
          </div>
        )}

        {!showWaitlist && !showSavePrompt && (
          <Button fullWidth size="lg" disabled={autoLocating} onClick={handleConfirm}>
            {isOutside ? 'Outside delivery area' : 'Confirm spot'}
          </Button>
        )}
      </div>
    </div>
  )
}
