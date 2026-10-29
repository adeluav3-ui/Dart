import { createAdminClient } from '@/lib/supabase/admin'
import { PinsListClient } from './PinsListClient'

export const dynamic = 'force-dynamic'

export default async function AreaPinsPage() {
  const admin = createAdminClient()

  const [{ data: areas }, { data: logs }] = await Promise.all([
    admin.from('areas').select('*').order('sort_order'),
    admin.from('location_detection_log').select('area_id_suggested, area_id_chosen'),
  ])

  // Compute correction rate per area
  const corrMap: Record<string, { total: number; corrections: number }> = {}
  for (const log of logs ?? []) {
    if (!log.area_id_suggested) continue
    const e = corrMap[log.area_id_suggested] ?? { total: 0, corrections: 0 }
    e.total++
    if (log.area_id_chosen !== log.area_id_suggested) e.corrections++
    corrMap[log.area_id_suggested] = e
  }
  const correctionRates: Record<string, number> = {}
  for (const [id, e] of Object.entries(corrMap)) {
    correctionRates[id] = e.total >= 5 ? e.corrections / e.total : 0
  }

  return (
    <PinsListClient
      initialAreas={areas ?? []}
      correctionRates={correctionRates}
    />
  )
}
