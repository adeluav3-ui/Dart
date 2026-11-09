import { createAdminClient } from '@/lib/supabase/admin'
import { ApplicationsClient } from './ApplicationsClient'
import type { ApplicationKind, ApplicationStatus } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function AdminApplicationsPage() {
  const admin = createAdminClient()

  const { data: rawApps } = await admin
    .from('applications')
    .select('*')
    .order('created_at', { ascending: true })

  const appList = rawApps ?? []

  // Fetch profiles separately (applications.user_id → auth.users, not profiles)
  const userIds = [...new Set(appList.map((a: { user_id: string }) => a.user_id))]
  const profileMap: Record<string, { full_name: string | null; phone: string | null }> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', userIds)
    for (const p of profiles ?? []) {
      profileMap[p.id] = { full_name: p.full_name, phone: p.phone }
    }
  }

  const apps = appList.map((a: {
    id: string; user_id: string; kind: ApplicationKind; status: ApplicationStatus
    data: Record<string, unknown>; admin_note: string | null
    created_at: string; decided_at: string | null
  }) => ({
    ...a,
    applicant_name: profileMap[a.user_id]?.full_name ?? 'Unknown',
    applicant_phone: profileMap[a.user_id]?.phone ?? null,
  }))

  return <ApplicationsClient initialApps={apps} />
}
