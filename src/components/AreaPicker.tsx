'use client'

import { useState, useRef, lazy, Suspense } from 'react'
import { X, Search, Navigation, Map } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { areaDisplayName } from '@/lib/format'
import type { Area, Zone, CoverageArea } from '@/types/database'

// Lazy-load MapPicker to avoid pulling Leaflet into the initial bundle
const MapPicker = lazy(() => import('./MapPicker').then(m => ({ default: m.MapPicker })))

interface Props {
  areas: Area[]
  zones: Zone[]
  selectedId: string
  onSave: (areaId: string | null, areaName: string, lat: number, lng: number, description: string, label?: string) => void
  onClose?: () => void
  coverageAreas?: CoverageArea[]
  userId?: string | null
}

function normalizeText(s: string) {
  return s.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function AreaPicker({ areas, zones, selectedId, onSave, onClose, coverageAreas, userId }: Props) {
  const [selected, setSelected] = useState(selectedId)
  const [search, setSearch] = useState('')
  const [showMap, setShowMap] = useState(false)
  const [description, setDescription] = useState('')
  const [waitlistArea, setWaitlistArea] = useState<string | null>(null)
  const [waitlistAreaName, setWaitlistAreaName] = useState('')
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistSent, setWaitlistSent] = useState(false)
  const [waitlistSaving, setWaitlistSaving] = useState(false)
  const waitlistRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Only show areas that are active
  const activeAreas = areas.filter(a => a.is_active !== false)

  const normalizedSearch = normalizeText(search)
  const zoneMap = Object.fromEntries(zones.map(z => [z.id, z]))
  const isSearching = !!normalizedSearch

  const filtered = activeAreas.filter(a => {
    if (!normalizedSearch) return true
    return (
      normalizeText(a.name).includes(normalizedSearch) ||
      normalizeText(a.district ?? '').includes(normalizedSearch) ||
      a.aliases.some(alias => normalizeText(alias).includes(normalizedSearch))
    )
  })

  type DistrictGroup = { district: string | null; areas: Area[] }
  type ZoneGroup = { zoneId: string | null; zoneName: string; districtGroups: DistrictGroup[] }

  const zoneGroups: ZoneGroup[] = []
  const seenZones = new Set<string | null>()
  for (const a of filtered) {
    if (!seenZones.has(a.zone_id)) {
      seenZones.add(a.zone_id)
      const zoneAreas = filtered.filter(x => x.zone_id === a.zone_id)
      const districtGroups: DistrictGroup[] = []
      const seenDistricts = new Set<string | null>()
      for (const za of zoneAreas) {
        if (!seenDistricts.has(za.district)) {
          seenDistricts.add(za.district)
          districtGroups.push({
            district: za.district,
            areas: zoneAreas.filter(x => x.district === za.district),
          })
        }
      }
      zoneGroups.push({
        zoneId: a.zone_id,
        zoneName: a.zone_id ? (zoneMap[a.zone_id]?.name ?? 'Other') : 'Coming Soon',
        districtGroups,
      })
    }
  }

  // Also include coming-soon areas in a separate section
  const comingSoonAreas = areas.filter(a => a.status === 'coming_soon')
  if (comingSoonAreas.length > 0 && !normalizedSearch) {
    zoneGroups.push({
      zoneId: '__coming_soon',
      zoneName: 'Coming Soon',
      districtGroups: [{ district: null, areas: comingSoonAreas }],
    })
  }

  function openWaitlist(prefilledName?: string) {
    setWaitlistArea(prefilledName ?? '')
    setWaitlistAreaName(prefilledName ?? '')
    setWaitlistSent(false)
    setTimeout(() => waitlistRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  async function submitWaitlist() {
    if (!waitlistAreaName.trim()) return
    setWaitlistSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('area_requests').insert({
      area_name: waitlistAreaName.trim(),
      user_id: user?.id ?? null,
      email: waitlistEmail.trim() || null,
    })
    setWaitlistSaving(false)
    setWaitlistSent(true)
  }

  const descLen = description.trim().length
  const descOk = descLen >= 10 && descLen <= 140

  function handleContinue() {
    const area = activeAreas.find(a => a.id === selected && a.status === 'active')
    if (!area || area.lat == null || area.lng == null || !descOk) return
    onSave(area.id, areaDisplayName(area), area.lat, area.lng, description.trim())
  }

  function handleMapConfirm(lat: number, lng: number, address: string, description: string, label?: string) {
    onSave(null, address || 'My location', lat, lng, description, label)
  }

  const selectedArea = activeAreas.find(a => a.id === selected && a.status === 'active')
  const canContinue = !!selectedArea && selectedArea.lat != null && selectedArea.lng != null

  if (showMap) {
    const currentPin = selectedArea
      ? { lat: selectedArea.lat!, lng: selectedArea.lng! }
      : undefined

    return (
      <Suspense fallback={null}>
        <MapPicker
          initialLat={currentPin?.lat}
          initialLng={currentPin?.lng}
          onConfirm={handleMapConfirm}
          onClose={() => setShowMap(false)}
          areas={areas}
          userId={userId}
        />
      </Suspense>
    )
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />

      <div
        className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-3xl max-w-md mx-auto flex flex-col"
        style={{ maxHeight: '88dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <span className="font-heading font-bold text-[17px]">Choose your area</span>
          {onClose && (
            <button type="button" onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-surface">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Action row: Use my location (auto-GPS via MapPicker) */}
        <div className="px-4 pb-3 shrink-0 flex gap-2">
          <button
            type="button"
            onClick={() => setShowMap(true)}
            className="flex-1 flex items-center justify-center gap-2 h-11 px-4 rounded-2xl border border-brand bg-brand-tint text-brand font-semibold text-[14px]"
          >
            <Navigation size={16} />
            Use my location
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 px-4 pb-3 shrink-0">
          <div className="flex-1 h-px bg-line" />
          <span className="text-[12px] text-ink-2 font-medium">or pick from the list</span>
          <div className="flex-1 h-px bg-line" />
        </div>

        {/* Search */}
        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-center gap-2 h-10 px-3 rounded-xl bg-surface">
            <Search size={14} stroke="#5B6168" />
            <input
              type="search"
              placeholder="Search areas or districts…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[14px] font-body text-ink outline-none placeholder:text-ink-2/60"
            />
          </div>
        </div>

        {/* Area list */}
        <div className="flex-1 overflow-y-auto px-4">
          {zoneGroups.length === 0 && (
            <p className="text-sm text-ink-2 text-center py-6">No areas match your search</p>
          )}

          {zoneGroups.map(zoneGroup => (
            <div key={zoneGroup.zoneId ?? '__coming_soon'} className="mb-3">
              <p className="text-[11px] font-bold text-ink-2 uppercase tracking-wide px-1 mb-1">
                {zoneGroup.zoneName}
              </p>

              {zoneGroup.districtGroups.map(dg => (
                <div key={dg.district ?? '__no_district'}>
                  {dg.district && !isSearching && (
                    <p className="text-[12px] font-semibold text-ink-2 px-2 pt-1 pb-0.5">
                      {dg.district}
                    </p>
                  )}

                  {dg.areas.map(area => {
                    const isComing = area.status === 'coming_soon'
                    const isSelected = area.id === selected
                    const label = (isSearching && area.district)
                      ? areaDisplayName(area)
                      : area.name

                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => {
                          if (isComing) {
                            openWaitlist(areaDisplayName(area))
                          } else {
                            setSelected(area.id)
                          }
                        }}
                        className={`flex items-center justify-between w-full px-4 py-3.5 rounded-2xl text-left mb-1 transition-colors ${
                          dg.district && !isSearching ? 'pl-6' : ''
                        } ${
                          isComing
                            ? 'hover:bg-surface active:bg-surface'
                            : isSelected
                            ? 'bg-brand-tint'
                            : 'hover:bg-surface active:bg-surface'
                        }`}
                      >
                        <span className={`text-[15px] font-medium ${isComing ? 'text-ink-2' : 'text-ink'}`}>
                          {label}
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          {isComing && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface text-ink-2">
                              Notify me
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
            </div>
          ))}

          <p className="text-[13px] text-ink-2 text-center px-2 py-3">
            Not sure? Use your location above — we&apos;ll detect it automatically.
          </p>

          {/* Waitlist */}
          <div ref={waitlistRef} className="mb-4 mt-1">
            {waitlistArea === null ? (
              <button
                type="button"
                onClick={() => openWaitlist()}
                className="text-[14px] font-semibold text-brand px-1"
              >
                My area isn&apos;t listed →
              </button>
            ) : waitlistSent ? (
              <div className="px-4 py-3 rounded-2xl bg-brand-tint text-brand-ink text-[14px] font-medium">
                {waitlistAreaName
                  ? `Got it! We'll let you know when we start delivering to ${waitlistAreaName}.`
                  : "Got it! We'll reach out when we expand there."}
              </div>
            ) : (
              <div className="flex flex-col gap-2 p-4 rounded-2xl bg-surface">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-ink">
                    {waitlistArea
                      ? `Join waitlist for ${waitlistArea}`
                      : "We'll expand when there's enough demand"}
                  </p>
                  <button type="button" onClick={() => setWaitlistArea(null)} className="text-ink-2">
                    <X size={14} />
                  </button>
                </div>
                {!waitlistArea && (
                  <input
                    type="text"
                    placeholder="Your area name"
                    value={waitlistAreaName}
                    onChange={e => setWaitlistAreaName(e.target.value)}
                    className="h-10 px-3 rounded-xl border border-line font-body text-[14px] text-ink bg-white"
                  />
                )}
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

        {/* Description + confirm (when area selected from list) */}
        {canContinue && (
          <div className="px-4 pt-3 border-t border-line shrink-0 flex flex-col gap-2"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-ink-2">
                Describe your exact spot <span className="text-danger">*</span>
              </span>
              <input
                type="text"
                placeholder="e.g. Blue gate opposite Iya Risi shop"
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={140}
                className="h-10 px-3 rounded-xl border border-line font-body text-[14px] text-ink bg-white placeholder:text-ink-2/60 outline-none focus:border-brand transition-colors"
              />
              <div className="flex items-center px-0.5">
                {descLen > 0 && descLen < 10 && (
                  <span className="text-[11px] text-ink-2">{10 - descLen} more chars needed</span>
                )}
                {descLen >= 10 && (
                  <span className="text-[11px] text-brand font-semibold">✓</span>
                )}
                <span className="text-[11px] text-ink-2 ml-auto">{descLen}/140</span>
              </div>
            </label>
            <Button onClick={handleContinue} disabled={!descOk} fullWidth size="lg">
              Confirm spot in {selectedArea ? areaDisplayName(selectedArea) : ''}
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
