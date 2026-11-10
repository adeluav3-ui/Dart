'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Navigation, Search, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { findCoveringArea } from '@/lib/coverageCircles'
import { createClient } from '@/lib/supabase/client'
import type { Area, DeliverySpot, DeliverySpotLabel } from '@/types/database'

interface Props {
  initialLat?: number
  initialLng?: number
  onConfirm: (lat: number, lng: number, areaName: string, description: string, label?: string) => void
  onClose: () => void
  coverageAreas?: unknown[]
  areas?: Area[]
  userId?: string | null
}

// OOUTH Main Gate, Sagamu
const DEFAULT_LAT = 6.7073
const DEFAULT_LNG = 3.8858

const SPOT_LABELS: DeliverySpotLabel[] = ['Home', 'Hostel', 'Work', 'Other']

interface PlaceResult {
  placeId: string
  main: string
  secondary: string
}

function newToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function MapPicker({ initialLat, initialLng, onConfirm, onClose, areas, userId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const accuracyCircleRef = useRef<any>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reverseDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Phase: 'pin' = map + search, 'describe' = write your own description
  const [phase, setPhase] = useState<'pin' | 'describe'>('pin')

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

  // Live place name shown while positioning the pin (never saved)
  const [previewName, setPreviewName] = useState('')
  const [reverseLoading, setReverseLoading] = useState(false)

  // Set when user taps "Confirm spot" in phase 1
  const [confirmedPos, setConfirmedPos] = useState<{
    lat: number; lng: number; areaName: string; previewName: string
  } | null>(null)

  // ── Search state ──────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('')
  const [sessionToken, setSessionToken] = useState('')
  const [searchResults, setSearchResults] = useState<PlaceResult[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchUnavailable, setSearchUnavailable] = useState(false)
  const [searchHint, setSearchHint] = useState(false)

  // ── Other state ───────────────────────────────────────────────────────────
  const [showWaitlist, setShowWaitlist] = useState(false)
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistSaving, setWaitlistSaving] = useState(false)
  const [waitlistSent, setWaitlistSent] = useState(false)
  const [description, setDescription] = useState('')
  const [savedSpots, setSavedSpots] = useState<DeliverySpot[]>([])
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [savingSpot, setSavingSpot] = useState(false)

  const descLen = description.trim().length
  const descOk = descLen >= 10 && descLen <= 140

  const areasRef = useRef(areas)
  useEffect(() => { areasRef.current = areas }, [areas])

  // Load saved spots
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    supabase
      .from('delivery_spots')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setSavedSpots(data as DeliverySpot[]) })
  }, [userId])

  // Reverse geocoding (debounced). Called directly after GPS locate or on dragend —
  // never on moveend, so programmatic setView() after a search won't overwrite the
  // Google Places name the user just selected.
  const scheduleReverseGeocode = useCallback((lat: number, lng: number) => {
    if (reverseDebounceRef.current) clearTimeout(reverseDebounceRef.current)
    reverseDebounceRef.current = setTimeout(async () => {
      setReverseLoading(true)
      try {
        const res = await fetch(`/api/places/reverse?lat=${lat}&lng=${lng}`)
        const data = await res.json()
        if (data.name) setPreviewName(data.name)
      } catch {}
      finally { setReverseLoading(false) }
    }, 600)
  }, [])

  // Map init
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
        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.remove()
          accuracyCircleRef.current = null
        }
        if (areasRef.current && areasRef.current.length > 0) {
          setCoveringArea(findCoveringArea(lat, lng, areasRef.current))
        }
      })

      // Reverse geocode only after the user manually drags — not after programmatic
      // setView() calls (search results, GPS jumps), which call scheduleReverseGeocode
      // directly so the name they set isn't overwritten.
      map.on('dragend', () => {
        if (!mounted) return
        const { lat, lng } = map.getCenter()
        scheduleReverseGeocode(lat, lng)
      })

      mapRef.current = map

      if (initialLat == null) {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            pos => {
              if (!mounted) return
              // Reject IP-based geolocation — accuracy worse than 2 km means the browser
              // is guessing from the network, not from GPS/WiFi. It can be 50+ km off.
              if (pos.coords.accuracy > 2000) {
                setAutoLocating(false)
                setAutoLocateError("Couldn't detect your precise location — drag the map to your spot")
                return
              }
              map.setView([pos.coords.latitude, pos.coords.longitude], 17)
              if (pos.coords.accuracy > 100) {
                accuracyCircleRef.current = L.circle(
                  [pos.coords.latitude, pos.coords.longitude],
                  { radius: pos.coords.accuracy, color: '#0B7A47', fillColor: '#0B7A47', fillOpacity: 0.08, weight: 1.5 }
                ).addTo(map)
              }
              setAutoLocating(false)
              scheduleReverseGeocode(pos.coords.latitude, pos.coords.longitude)
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
          setAutoLocateError("Location not supported in this browser — drag the map to your spot")
        }
      } else {
        scheduleReverseGeocode(initialLat, initialLng!)
      }
    }

    initMap()

    return () => {
      mounted = false
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
      if (reverseDebounceRef.current) clearTimeout(reverseDebounceRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function locateMe() {
    if (!navigator.geolocation || !mapRef.current) return
    setLocating(true)
    setAutoLocateError('')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        if (pos.coords.accuracy > 2000) {
          setLocating(false)
          setAutoLocateError("Couldn't detect your precise location — drag the map to your spot")
          return
        }
        const L = (await import('leaflet')).default
        if (mapRef.current) {
          mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 17)
          if (accuracyCircleRef.current) { accuracyCircleRef.current.remove(); accuracyCircleRef.current = null }
          if (pos.coords.accuracy > 100) {
            accuracyCircleRef.current = L.circle(
              [pos.coords.latitude, pos.coords.longitude],
              { radius: pos.coords.accuracy, color: '#0B7A47', fillColor: '#0B7A47', fillOpacity: 0.08, weight: 1.5 }
            ).addTo(mapRef.current)
          }
        }
        setLocating(false)
      },
      () => { setLocating(false); setAutoLocateError("Couldn't detect your location — drag the map to your spot") },
      { timeout: 8000, enableHighAccuracy: true }
    )
  }

  function jumpToSpot(spot: DeliverySpot) {
    if (mapRef.current) mapRef.current.setView([spot.lat, spot.lng], 17)
  }

  // ── Places search ──────────────────────────────────────────────────────────
  function handleSearchFocus() {
    if (!sessionToken) setSessionToken(newToken())
  }

  const runSearch = useCallback(async (value: string, token: string) => {
    setSearchLoading(true)
    try {
      const res = await fetch('/api/places/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: value, sessionToken: token }),
      })
      if (res.status === 429) {
        setSearchUnavailable(true); setSearchResults(null); return
      }
      const data = await res.json()
      if (data.unavailable) {
        setSearchUnavailable(true); setSearchResults(null); return
      }
      setSearchUnavailable(false)
      setSearchResults((data.results ?? []) as PlaceResult[])
    } catch {
      setSearchUnavailable(true); setSearchResults(null)
    } finally {
      setSearchLoading(false)
    }
  }, [])

  function handleSearchChange(value: string) {
    setSearchInput(value)
    setSearchUnavailable(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length < 3) { setSearchResults(null); return }
    debounceRef.current = setTimeout(() => runSearch(value, sessionToken), 350)
  }

  async function selectResult(result: PlaceResult) {
    setSearchInput('')
    setSearchResults(null)
    setSearchUnavailable(false)
    // Show the place name the customer selected immediately (before reverse geocode)
    setPreviewName(`${result.main}${result.secondary ? `, ${result.secondary}` : ''}`)

    try {
      const res = await fetch(
        `/api/places/location?placeId=${encodeURIComponent(result.placeId)}&sessionToken=${encodeURIComponent(sessionToken)}`
      )
      const data = await res.json()
      if (data.unavailable || typeof data.lat !== 'number' || typeof data.lng !== 'number') return
      if (mapRef.current) {
        mapRef.current.setView([data.lat, data.lng], 18)
      }
      setSearchHint(true)
      setTimeout(() => setSearchHint(false), 6000)
    } catch {}

    setSessionToken(newToken())
  }

  function clearSearch() {
    setSearchInput('')
    setSearchResults(null)
    setSearchUnavailable(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }

  // ── Waitlist ───────────────────────────────────────────────────────────────
  async function submitWaitlist() {
    setWaitlistSaving(true)
    const supabase = createClient()
    await supabase.from('coverage_waitlist').insert({
      email: waitlistEmail.trim() || null,
      lat: center.lat, lng: center.lng, user_id: userId ?? null,
    })
    setWaitlistSaving(false)
    setWaitlistSent(true)
  }

  // ── Phase 1 → Phase 2 ─────────────────────────────────────────────────────
  function handleConfirm() {
    if ((areas?.length ?? 0) > 0) {
      const covering = findCoveringArea(center.lat, center.lng, areas ?? [])
      if (!covering) { setShowWaitlist(true); return }
      setConfirmedPos({
        lat: center.lat,
        lng: center.lng,
        areaName: covering.name,
        previewName: previewName || covering.name,
      })
    } else {
      // No delivery areas configured (e.g. vendor setting their shop location) —
      // allow pinning anywhere; use the reverse-geocoded name as the area label.
      setConfirmedPos({
        lat: center.lat,
        lng: center.lng,
        areaName: previewName || 'My location',
        previewName: previewName || 'My location',
      })
    }
    setPhase('describe')
  }

  // ── Phase 2: save ──────────────────────────────────────────────────────────
  function handleSave() {
    if (!confirmedPos || !descOk) return
    if (userId) { setShowSavePrompt(true); return }
    onConfirm(confirmedPos.lat, confirmedPos.lng, confirmedPos.areaName, description.trim())
  }

  async function saveSpotAndConfirm(label: DeliverySpotLabel) {
    if (!confirmedPos || !userId) return
    setSavingSpot(true)
    const supabase = createClient()
    await supabase.from('delivery_spots').insert({
      user_id: userId,
      label,
      lat: confirmedPos.lat,
      lng: confirmedPos.lng,
      area_id: coveringArea?.id ?? null,
      description: description.trim() || null,
      is_default: savedSpots.length === 0,
    })
    setSavingSpot(false)
    setShowSavePrompt(false)
    onConfirm(confirmedPos.lat, confirmedPos.lng, confirmedPos.areaName, description.trim(), label)
  }

  // Only block confirm if areas are actually provided and the pin is outside all of them
  const isOutside = (areas?.length ?? 0) > 0 && !findCoveringArea(center.lat, center.lng, areas ?? [])
  const showResultsDropdown = searchInput.length >= 3 && (searchResults !== null || searchUnavailable)

  // ── Phase 2: description screen ───────────────────────────────────────────
  if (phase === 'describe') {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col bg-white">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line shrink-0"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
          <button type="button" onClick={() => setPhase('pin')}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-surface">
            <ArrowLeft size={16} />
          </button>
          <span className="font-heading font-bold text-[16px]">Describe your spot</span>
        </div>

        <div className="flex-1 flex flex-col px-4 py-5 gap-4 overflow-y-auto">
          {/* Confirmed location card */}
          <div className="bg-brand-tint rounded-2xl px-4 py-3.5 flex flex-col gap-0.5">
            <span className="text-[11px] font-bold text-brand-ink tracking-wide uppercase">Delivering to</span>
            <span className="text-[16px] font-bold text-ink leading-snug">
              {confirmedPos?.previewName || confirmedPos?.areaName}
            </span>
            {confirmedPos?.previewName && confirmedPos.previewName !== confirmedPos.areaName && (
              <span className="text-[12px]" style={{ color: '#5B6168' }}>
                Near {confirmedPos.areaName}
              </span>
            )}
          </div>

          {/* Description field */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[14px] font-semibold text-ink">Help your rider find you</span>
            <p className="text-[13px] text-ink-2">
              Describe the gate, building type, or a landmark right next to it — in your own words.
            </p>
            <input
              type="text"
              placeholder="e.g. Blue gate opposite Iya Risi shop"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={140}
              autoFocus
              className="h-11 px-3 rounded-xl border border-line font-body text-[14px] text-ink bg-white placeholder:text-ink-2/60 outline-none focus:border-brand transition-colors"
            />
            <div className="flex items-center px-0.5">
              {descLen > 0 && descLen < 10 && (
                <span className="text-[11px] text-ink-2">{10 - descLen} more chars needed</span>
              )}
              {descLen >= 10 && (
                <span className="text-[11px] text-brand font-semibold">✓ Good description</span>
              )}
              <span className="text-[11px] text-ink-2 ml-auto">{descLen}/140</span>
            </div>
          </div>
        </div>

        {showSavePrompt ? (
          <div className="px-4 pt-3 border-t border-line shrink-0 flex flex-col gap-2"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
            <p className="text-[13px] font-semibold text-ink text-center">Save this spot as…</p>
            <div className="flex gap-2 flex-wrap justify-center">
              {SPOT_LABELS.map(label => (
                <button key={label} type="button" disabled={savingSpot}
                  onClick={() => saveSpotAndConfirm(label)}
                  className="h-9 px-4 rounded-full border border-line bg-white font-semibold text-[13px] text-ink disabled:opacity-50">
                  {label}
                </button>
              ))}
            </div>
            <button type="button"
              onClick={() => {
                setShowSavePrompt(false)
                if (confirmedPos) onConfirm(confirmedPos.lat, confirmedPos.lng, confirmedPos.areaName, description.trim())
              }}
              className="text-[13px] text-ink-2 text-center">
              Skip, don&apos;t save
            </button>
          </div>
        ) : (
          <div className="px-4 pt-3 border-t border-line shrink-0"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
            <Button fullWidth size="lg" disabled={!descOk} onClick={handleSave}>
              {!descOk ? 'Describe your spot first' : 'Save my delivery spot'}
            </Button>
          </div>
        )}
      </div>
    )
  }

  // ── Phase 1: map screen ───────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        <button type="button" onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-surface">
          <X size={16} />
        </button>
        <span className="font-heading font-bold text-[16px]">Confirm your delivery spot</span>
      </div>

      {/* Saved spots chips */}
      {savedSpots.length > 0 && (
        <div className="px-4 pt-3 pb-1 shrink-0 flex gap-2 overflow-x-auto scrollbar-hide">
          {savedSpots.map(spot => (
            <button key={spot.id} type="button" onClick={() => jumpToSpot(spot)}
              className="flex-none h-8 px-3 rounded-full bg-surface border border-line text-[13px] font-semibold text-ink whitespace-nowrap">
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

        {/* Search box */}
        <div className="absolute top-3 left-3 right-16 flex flex-col gap-1" style={{ zIndex: 1002 }}>
          <div className="flex items-center gap-2 h-10 px-3 rounded-xl bg-white shadow-md border border-line">
            {searchLoading
              ? <span className="w-3.5 h-3.5 rounded-full border-2 border-brand/30 border-t-brand animate-spin shrink-0" />
              : <Search size={14} stroke="#5B6168" className="shrink-0" />}
            <input
              type="search"
              placeholder="Search a place, e.g. OOUTH, a school, a church"
              value={searchInput}
              onFocus={handleSearchFocus}
              onChange={e => handleSearchChange(e.target.value)}
              className="flex-1 bg-transparent font-body text-[13px] text-ink outline-none placeholder:text-ink-2/50 min-w-0"
            />
            {searchInput && (
              <button type="button" onClick={clearSearch} className="shrink-0 text-ink-2">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Results dropdown */}
          {showResultsDropdown && (
            <div className="bg-white rounded-xl shadow-lg border border-line overflow-hidden">
              {searchUnavailable ? (
                <p className="px-3 py-3 text-[13px] text-ink-2 leading-snug">
                  Search isn&apos;t available right now. Drag the map to your spot instead.
                </p>
              ) : searchResults?.length === 0 ? (
                <p className="px-3 py-3 text-[13px] text-ink-2">
                  No places found. Drag the map to your spot instead.
                </p>
              ) : (
                <>
                  {searchResults?.map(result => (
                    <button key={result.placeId} type="button" onClick={() => selectResult(result)}
                      className="w-full px-3 py-2.5 text-left border-b border-line last:border-0 active:bg-surface">
                      <p className="text-[14px] font-bold text-ink leading-snug">{result.main}</p>
                      {result.secondary && (
                        <p className="text-[12px] leading-snug" style={{ color: '#5B6168' }}>{result.secondary}</p>
                      )}
                    </button>
                  ))}
                  <div className="px-3 py-1.5 flex items-center justify-end gap-1 bg-surface/60">
                    <span className="text-[10px] text-ink-2">Powered by</span>
                    <svg viewBox="0 0 44 16" width="38" height="14" xmlns="http://www.w3.org/2000/svg" aria-label="Google">
                      <path d="M17.6 8.2c0-.5 0-1-.1-1.5H9v2.9h4.8c-.2 1.1-.9 2-1.9 2.6v2.1h3c1.8-1.6 2.7-4 2.7-6.1z" fill="#4285F4"/>
                      <path d="M9 17c2.4 0 4.5-.8 6-2.2l-3-2.1c-.8.5-1.8.8-3 .8-2.3 0-4.3-1.6-5-3.7H.9v2.2C2.4 15.1 5.5 17 9 17z" fill="#34A853"/>
                      <path d="M4 9.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V4H.9C.3 5.2 0 6.6 0 8s.3 2.8.9 4L4 9.8z" fill="#FBBC05"/>
                      <path d="M9 3.6c1.3 0 2.5.4 3.4 1.3l2.5-2.5C13.5.9 11.4 0 9 0 5.5 0 2.4 1.9.9 4.8L4 7c.7-2.1 2.7-3.4 5-3.4z" fill="#EA4335"/>
                    </svg>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Fixed centre pin */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1000 }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 22, height: 11, borderRadius: 9999,
            background: 'rgba(0,0,0,0.22)', filter: 'blur(3px)',
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
          <button type="button" onClick={locateMe} disabled={locating}
            className="absolute top-3 right-3 w-11 h-11 rounded-full bg-white shadow-md flex items-center justify-center border border-line disabled:opacity-60"
            aria-label="Re-centre on my location"
            style={{ zIndex: 1001 }}>
            {locating
              ? <span className="w-4 h-4 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
              : <Navigation size={18} stroke="#0B7A47" />}
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pt-3 pb-5 border-t border-line shrink-0 flex flex-col gap-2.5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>

        {/* Live place name */}
        <div className="flex flex-col items-center gap-0.5 min-h-[36px] justify-center">
          {reverseLoading && !previewName ? (
            <span className="w-3 h-3 rounded-full border-2 border-brand/20 border-t-brand animate-spin" />
          ) : previewName ? (
            <>
              <span className="text-[15px] font-bold text-ink text-center leading-snug">{previewName}</span>
              {coveringArea && (
                <span className="text-[12px]" style={{ color: '#5B6168' }}>Delivery zone: {coveringArea.name}</span>
              )}
            </>
          ) : coveringArea ? (
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 36 50" fill="none">
                <path d="M18 0C8.059 0 0 8.059 0 18C0 30 18 50 18 50C18 50 36 30 36 18C36 8.059 27.941 0 18 0Z" fill="#0B7A47"/>
              </svg>
              <span className="text-[14px] font-semibold text-ink">{coveringArea.name}</span>
            </div>
          ) : null}
        </div>

        {/* Instruction */}
        <p className="text-[13px] text-ink-2 text-center leading-snug">
          {searchHint
            ? 'Now drag the map so the pin is on your exact building.'
            : autoLocateError || 'Drag the map so the pin is on your exact spot, then confirm.'}
        </p>

        {/* Waitlist panel */}
        {showWaitlist && !waitlistSent && (
          <div className="flex flex-col gap-2 p-3 rounded-2xl bg-warn-tint">
            <p className="text-[13px] font-semibold text-warn text-center">
              This spot is outside our delivery area
            </p>
            <input type="email" placeholder="Email for updates (optional)"
              value={waitlistEmail} onChange={e => setWaitlistEmail(e.target.value)}
              className="h-10 px-3 rounded-xl border border-line font-body text-[14px] text-ink bg-white" />
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

        {!showWaitlist && (
          <Button fullWidth size="lg" disabled={autoLocating || isOutside} onClick={handleConfirm}>
            {isOutside ? 'Outside delivery area' : 'Confirm spot'}
          </Button>
        )}
      </div>
    </div>
  )
}
