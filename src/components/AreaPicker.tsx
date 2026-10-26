'use client'

import { useState } from 'react'
import { X, Search, Navigation } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import type { Area, Zone } from '@/types/database'

interface Props {
  areas: Area[]
  zones: Zone[]
  selectedId: string
  onSave: (areaId: string, areaName: string) => void
  onClose?: () => void
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function normalizeText(s: string) {
  return s.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function AreaPicker({ areas, zones, selectedId, onSave, onClose }: Props) {
  const [selected, setSelected] = useState(selectedId)
  const [search, setSearch] = useState('')
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState('')
  const [showWaitlist, setShowWaitlist] = useState(false)
  const [waitlistArea, setWaitlistArea] = useState('')
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistSent, setWaitlistSent] = useState(false)
  const [waitlistSaving, setWaitlistSaving] = useState(false)
  const supabase = createClient()

  const normalizedSearch = normalizeText(search)
  const zoneMap = Object.fromEntries(zones.map(z => [z.id, z]))

  const filtered = areas.filter(a => {
    if (!normalizedSearch) return true
    return (
      normalizeText(a.name).includes(normalizedSearch) ||
      a.aliases.some(alias => normalizeText(alias).includes(normalizedSearch))
    )
  })

  // Group by zone_id, preserving order of first appearance
  type Group = { zoneId: string | null; zoneName: string; areas: Area[] }
  const groups: Group[] = []
  const seen = new Set<string | null>()
  for (const a of filtered) {
    if (!seen.has(a.zone_id)) {
      seen.add(a.zone_id)
      groups.push({
        zoneId: a.zone_id,
        zoneName: a.zone_id ? (zoneMap[a.zone_id]?.name ?? 'Other') : 'Coming Soon',
        areas: filtered.filter(x => x.zone_id === a.zone_id),
      })
    }
  }

  function detectLocation() {
    if (!navigator.geolocation) { setLocError('Location not supported on this device'); return }
    setLocating(true)
    setLocError('')
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        let nearest: Area | null = null
        let nearestDist = Infinity
        for (const a of areas) {
          if (a.status !== 'active' || a.lat == null || a.lng == null) continue
          const dist = haversineKm(lat, lng, a.lat, a.lng)
          if (dist < nearestDist) { nearestDist = dist; nearest = a }
        }
        setLocating(false)
        if (nearest && nearestDist <= 3) {
          setSelected(nearest.id)
        } else {
          setLocError('No delivery area within 3 km. Select manually.')
        }
      },
      err => {
        setLocating(false)
        setLocError(
          err.code === 1
            ? 'Location access denied. Select your area manually.'
            : 'Could not get location. Select your area manually.'
        )
      },
      { timeout: 8000 }
    )
  }

  async function submitWaitlist() {
    if (!waitlistArea.trim()) return
    setWaitlistSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('area_requests').insert({
      area_name: waitlistArea.trim(),
      user_id: user?.id ?? null,
      email: waitlistEmail.trim() || null,
    })
    setWaitlistSaving(false)
    setWaitlistSent(true)
  }

  function handleContinue() {
    const area = areas.find(a => a.id === selected && a.status === 'active')
    if (!area) return
    onSave(selected, area.name)
  }

  const canContinue = !!areas.find(a => a.id === selected && a.status === 'active')

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl max-w-md mx-auto flex flex-col"
        style={{ maxHeight: '88dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <span className="font-heading font-bold text-[17px]">Choose your area</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-surface"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Detect location */}
        <div className="px-4 pb-3 shrink-0">
          <button
            type="button"
            onClick={detectLocation}
            disabled={locating}
            className="flex items-center gap-2.5 w-full h-11 px-4 rounded-2xl border border-brand bg-brand-tint text-brand font-semibold text-[14px] disabled:opacity-60"
          >
            {locating ? (
              <span className="w-4 h-4 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
            ) : (
              <Navigation size={16} />
            )}
            {locating ? 'Detecting…' : 'Use my current location'}
          </button>
          {locError && <p className="text-xs text-danger mt-1.5 px-1">{locError}</p>}
        </div>

        {/* Search */}
        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-center gap-2 h-10 px-3 rounded-xl bg-surface">
            <Search size={14} stroke="#5B6168" />
            <input
              type="search"
              placeholder="Search areas…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[14px] font-body text-ink outline-none placeholder:text-ink-2/60"
            />
          </div>
        </div>

        {/* Area list */}
        <div className="flex-1 overflow-y-auto px-4">
          {groups.length === 0 && (
            <p className="text-sm text-ink-2 text-center py-6">No areas match your search</p>
          )}

          {groups.map(group => (
            <div key={group.zoneId ?? '__coming_soon'} className="mb-3">
              <p className="text-[11px] font-bold text-ink-2 uppercase tracking-wide px-1 mb-1">
                {group.zoneName}
              </p>
              {group.areas.map(area => {
                const isComing = area.status === 'coming_soon'
                const isSelected = area.id === selected
                return (
                  <button
                    key={area.id}
                    type="button"
                    disabled={isComing}
                    onClick={() => setSelected(area.id)}
                    className={`flex items-center justify-between w-full px-4 py-3.5 rounded-2xl text-left mb-1 transition-colors ${
                      isComing
                        ? 'opacity-50 cursor-not-allowed'
                        : isSelected
                        ? 'bg-brand-tint'
                        : 'hover:bg-surface active:bg-surface'
                    }`}
                  >
                    <span className={`text-[15px] font-medium ${isComing ? 'text-ink-2' : 'text-ink'}`}>
                      {area.name}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      {isComing && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface text-ink-2">
                          Coming soon
                        </span>
                      )}
                      {isSelected && !isComing && (
                        <span className="w-5 h-5 rounded-full bg-brand flex items-center justify-center">
                          <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                            <path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}

          {/* Waitlist */}
          <div className="mb-4 mt-1">
            {!showWaitlist ? (
              <button
                type="button"
                onClick={() => setShowWaitlist(true)}
                className="text-[14px] font-semibold text-brand px-1"
              >
                My area isn&apos;t listed →
              </button>
            ) : waitlistSent ? (
              <div className="px-4 py-3 rounded-2xl bg-brand-tint text-brand-ink text-[14px] font-medium">
                Got it! We&apos;ll reach out when we expand there.
              </div>
            ) : (
              <div className="flex flex-col gap-2 p-4 rounded-2xl bg-surface">
                <p className="text-[13px] font-semibold text-ink">We&apos;ll expand when there&apos;s enough demand</p>
                <input
                  type="text"
                  placeholder="Your area (e.g. Ofin bus stop)"
                  value={waitlistArea}
                  onChange={e => setWaitlistArea(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-line font-body text-[14px] text-ink bg-white"
                />
                <input
                  type="email"
                  placeholder="Email for updates (optional)"
                  value={waitlistEmail}
                  onChange={e => setWaitlistEmail(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-line font-body text-[14px] text-ink bg-white"
                />
                <Button onClick={submitWaitlist} loading={waitlistSaving} size="sm" fullWidth>
                  Notify me when available
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Continue button */}
        <div className="px-4 pt-3 pb-3 border-t border-line shrink-0">
          <Button onClick={handleContinue} disabled={!canContinue} fullWidth size="lg">
            Continue
          </Button>
        </div>
      </div>
    </>
  )
}
