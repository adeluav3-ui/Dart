import { createAdminClient } from '@/lib/supabase/admin'
import { CoverageClient } from './CoverageClient'
import type { CoverageArea, CoverageWaitlistEntry } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function CoveragePage() {
  const admin = createAdminClient()

  const [{ data: areas }, { data: waitlist }] = await Promise.all([
    admin.from('coverage_areas').select('*').order('created_at'),
    admin.from('coverage_waitlist').select('*').order('created_at', { ascending: false }),
  ])

  return (
    <CoverageClient
      initialAreas={(areas as CoverageArea[]) ?? []}
      initialWaitlist={(waitlist as CoverageWaitlistEntry[]) ?? []}
    />
  )
}
