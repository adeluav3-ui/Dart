'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import { X, Navigation, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { isInsideCoverage } from '@/lib/coverage'
import type { CoverageArea } from '@/types/database'

interface Props {
  initialLat?: number
  initialLng?: number
  onConfirm: (lat: number, lng: number, address: string) => void
  onClose: () => void
  coverageAreas?: CoverageArea[]
}

// OOUTH Main Gate, Sagamu
const DEFAULT_LAT = 6.7073
const DEFAULT_LNG = 3.8858

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token) return ''
  try {
    // Mapbox expects longitude first
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng.toFixed(6)},${lat.toFixed(6)}.json?access_token=${token}&types=address,poi,neighborhood,locality&language=en&country=NG&limit=1`
    )
    if (!res.ok) return ''
    const data = await res.json()
    const name: string = data.features?.[0]?.place_name ?? ''
    // Strip ", Nigeria" suffix — redundant in a Nigeria-only app
    return name.replace(/,\s*Nigeria$/, '').trim()
  } catch {
    return ''
  }
}

export function MapPicker({ initialLat, initialLng, onConfirm, onClose, coverageAreas }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  const [center, setCenter] = useState({
    lat: initialLat ?? DEFAULT_LAT,
    lng: initialLng ?? DEFAULT_LNG,
  })
  const [locationName, setLocationName] = useState('')
  const [loadingAddress, setLoadingAddress] = useState(false)
  const [locating, setLocating] = useState(false)
  const [outsideCoverage, setOutsideCoverage] = useState(false)
  const [autoLocating, setAutoLocating] = useState(initialLat == null)
  const [autoLocateError, setAutoLocateError] = useState('')

  async function fetchAddress(lat: number, lng: number) {
    setLoadingAddress(true)
    const name = await reverseGeocode(lat, lng)
    setLocationName(name)
    setLoadingAddress(false)
  }

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

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      L.control.zoom({ position: 'bottomright' }).addTo(map)

      map.on('move', () => {
        const { lat, lng } = map.getCenter()
        setCenter({ lat, lng })
        setOutsideCoverage(false)
      })

      // Reverse geocode after map stops moving
      map.on('moveend', () => {
        if (!mounted) return
        const { lat, lng } = map.getCenter()
        fetchAddress(lat, lng)
      })

      mapRef.current = map

      if (initialLat == null) {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            pos => {
              if (!mounted) return
              // setView triggers moveend which fires fetchAddress
              map.setView([pos.coords.latitude, pos.coords.longitude], 17)
              setAutoLocating(false)
            },
            () => {
              if (!mounted) return
              setAutoLocating(false)
              setAutoLocateError("Couldn't get your location — move the map to your spot")
              fetchAddress(DEFAULT_LAT, DEFAULT_LNG)
            },
            { timeout: 10000, enableHighAccuracy: true }
          )
        } else {
          setAutoLocating(false)
          fetchAddress(DEFAULT_LAT, DEFAULT_LNG)
        }
      } else {
        // Known initial position: map doesn't move so moveend won't fire
        fetchAddress(initialLat, initialLng!)
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
      pos => {
        mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 17)
        setLocating(false)
      },
      () => setLocating(false),
      { timeout: 8000, enableHighAccuracy: true }
    )
  }

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
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {/* Shadow dot at pin tip (map centre) */}
          <div className="absolute top-1/2 left-1/2 w-4 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/20 blur-[2px]" />
          {/* Pin — shifted up so its tip sits at map centre */}
          <div
            className="-translate-y-5"
            style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))' }}
          >
            <MapPin size={44} fill="#0B7A47" stroke="white" strokeWidth={1.5} />
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
          >
            {locating
              ? <span className="w-4 h-4 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
              : <Navigation size={18} stroke="#0B7A47" />}
          </button>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 pt-3 pb-5 border-t border-line shrink-0"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
      >
        {/* Address display */}
        <div className="mb-3 min-h-[40px] flex flex-col justify-center">
          {loadingAddress ? (
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-brand/30 border-t-brand animate-spin shrink-0" />
              <span className="text-[13px] text-ink-2">Getting address…</span>
            </div>
          ) : locationName ? (
            <>
              <p className="text-[14px] font-semibold text-ink leading-snug">{locationName}</p>
              <p className="text-[12px] text-ink-2 mt-0.5">Move the map to adjust</p>
            </>
          ) : (
            <p className="text-[13px] text-ink-2">
              {autoLocateError || 'Move the map to your exact spot, then confirm.'}
            </p>
          )}
        </div>

        {outsideCoverage && (
          <p className="text-[13px] text-warn text-center mb-3 leading-snug">
            This spot is outside our delivery area. Move the pin to a covered part of Sagamu.
          </p>
        )}

        <Button fullWidth size="lg" disabled={autoLocating} onClick={() => {
          if (coverageAreas && coverageAreas.length > 0) {
            const inside = isInsideCoverage(center.lat, center.lng, coverageAreas)
            if (!inside) { setOutsideCoverage(true); return }
          }
          onConfirm(center.lat, center.lng, locationName)
        }}>
          Deliver here
        </Button>
      </div>
    </div>
  )
}
