import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { PinDetailClient } from './PinDetailClient'

export const dynamic = 'force-dynamic'

export default async function PinDetailPage({ params }: { params: { id: string } }) {
  const admin = createAdminClient()
  const supabase = createClient()

  const [{ data: area }, { data: history }, { data: logs }, { data: { user } }] = await Promise.all([
    admin.from('areas').select('*').eq('id', params.id).single(),
    admin.from('area_pin_history').select('*').eq('area_id', params.id).order('replaced_at', { ascending: false }).limit(3),
    admin.from('location_detection_log').select('area_id_suggested, area_id_chosen').eq('area_id_suggested', params.id),
    supabase.auth.getUser(),
  ])

  if (!area) notFound()

  const total = (logs ?? []).length
  const corrections = (logs ?? []).filter(l => l.area_id_chosen !== l.area_id_suggested).length
  const correctionRate = total >= 5 ? corrections / total : 0

  return (
    <PinDetailClient
      initialArea={area}
      initialHistory={history ?? []}
      correctionRate={correctionRate}
      correctionTotal={total}
      userId={user?.id ?? null}
    />
  )
}
