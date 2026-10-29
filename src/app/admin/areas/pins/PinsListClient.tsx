'use client'

import Link from 'next/link'
import { ChevronRight, MapPin } from 'lucide-react'
import type { Area } from '@/types/database'

interface Props {
  initialAreas: Area[]
  correctionRates: Record<string, number>
}

function relDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

export function PinsListClient({ initialAreas, correctionRates }: Props) {
  // No-pin areas first, then by sort_order
  const sorted = [...initialAreas].sort((a, b) => {
    const aPin = a.lat != null ? 1 : 0
    const bPin = b.lat != null ? 1 : 0
    if (aPin !== bPin) return aPin - bPin
    return a.sort_order - b.sort_order
  })

  const unpinned = sorted.filter(a => a.lat == null).length

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-bold text-xl">Area pins</h2>
          <p className="text-sm text-ink-2 mt-0.5">Stand at each location and tap to set the GPS pin.</p>
        </div>
        <Link href="/admin/areas" className="text-sm font-semibold text-brand">
          ← Areas
        </Link>
      </div>

      {unpinned > 0 && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-warn-tint border border-warn/20">
          <MapPin size={16} className="text-warn shrink-0" />
          <span className="text-sm font-semibold text-warn">
            {unpinned} {unpinned === 1 ? 'area has' : 'areas have'} no pin — location detection won&apos;t work for them.
          </span>
        </div>
      )}

      <div className="bg-white rounded-2xl divide-y divide-line overflow-hidden">
        {sorted.map(area => {
          const hasPin = area.lat != null
          const rate = correctionRates[area.id] ?? 0
          const highCorrection = hasPin && rate > 0.2

          return (
            <Link
              key={area.id}
              href={`/admin/areas/pins/${area.id}`}
              className="flex items-center gap-3 px-4 py-4 hover:bg-surface active:bg-surface no-underline"
            >
              {/* Status dot */}
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${hasPin ? 'bg-brand' : 'bg-[#F59E0B]'}`}
              />

              {/* Info */}
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="text-[15px] font-semibold text-ink">{area.name}</span>
                  {area.status === 'coming_soon' && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-surface text-ink-2 font-semibold">
                      Soon
                    </span>
                  )}
                  {highCorrection && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-warn-tint text-warn font-semibold">
                      ⚠ High correction
                    </span>
                  )}
                </span>
                {hasPin ? (
                  <span className="text-[13px] text-brand block mt-0.5">
                    Pin set
                    {area.accuracy_m != null && ` · ${Math.round(area.accuracy_m)}m accuracy`}
                    {area.pin_saved_at && ` · ${relDate(area.pin_saved_at)}`}
                  </span>
                ) : (
                  <span className="text-[13px] text-[#F59E0B] block mt-0.5">No pin</span>
                )}
              </span>

              <ChevronRight size={18} className="text-ink-2 shrink-0" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
