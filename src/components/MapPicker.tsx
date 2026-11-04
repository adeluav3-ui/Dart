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
  onConfirm: (lat: number, lng: number) => void
  onClose: () => void
  coverageAreas?: CoverageArea[]
}

// OOUTH Main Gate, Sagamu
const DEFAULT_LAT = 6.7073
const DEFAULT_LNG = 3.8858

export function MapPicker({ initialLat, initialLng, onConfirm, onClose, coverageAreas }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const [center, setCenter] = useState({
    lat: initialLat ?? DEFAULT_LAT,
    lng: initialLng ?? DEFAULT_LNG,
  })
  const [locating, setLocating] = useState(false)
  const [outsideCoverage, setOutsideCoverage] = useState(false)

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
        setOutsideCoverage(false) // clear error when map moves
      })

      mapRef.current = map
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
    navigator.geolocation.getCurrentPosition(
      pos => {
        mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 17)
        setLocating(false)
      },
      () => setLocating(false),
      { timeout: 8000 }
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
        <span className="font-heading font-bold text-[16px]">Pin your delivery spot</span>
      </div>

      {/* Map area */}
      <div className="relative flex-1">
        <div ref={containerRef} className="absolute inset-0" />

        {/* Fixed centre pin overlay */}
        <div
          className="absolute inset-0 pointer-events-none flex items-center justify-center"
          style={{ paddingBottom: '0px' }}
        >
          <div className="-translate-y-5">
            <MapPin size={40} fill="#0B7A47" stroke="white" strokeWidth={1.5} />
          </div>
        </div>

        {/* Locate-me button */}
        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          className="absolute top-3 right-3 w-11 h-11 rounded-full bg-white shadow-md flex items-center justify-center border border-line disabled:opacity-60"
          aria-label="Use my location"
        >
          {locating
            ? <span className="w-4 h-4 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
            : <Navigation size={18} stroke="#0B7A47" />}
        </button>
      </div>

      {/* Footer */}
      <div
        className="px-4 pt-3 pb-5 border-t border-line shrink-0"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
      >
        <p className="text-[13px] text-ink-2 text-center mb-3">
          Move the map so the pin is on your delivery spot
        </p>
        {outsideCoverage && (
          <p className="text-[13px] text-warn text-center mb-3 leading-snug">
            This spot is outside our delivery area. Move the pin to a covered part of Sagamu.
          </p>
        )}
        <Button fullWidth size="lg" onClick={() => {
          if (coverageAreas && coverageAreas.length > 0) {
            const inside = isInsideCoverage(center.lat, center.lng, coverageAreas)
            if (!inside) { setOutsideCoverage(true); return }
          }
          onConfirm(center.lat, center.lng)
        }}>
          Deliver here
        </Button>
      </div>
    </div>
  )
}
