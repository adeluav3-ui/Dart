import { createAdminClient } from '@/lib/supabase/admin'
import { ApplicationsClient } from './ApplicationsClient'
import type { ApplicationKind, ApplicationStatus } from '@/types/database'

export default async function AdminApplicationsPage() {
  const admin = createAdminClient()

  const { data: rawApps } = await admin
    .from('applications')
    .select('*, profiles(full_name, phone)')
    .order('created_at', { ascending: true })

  const apps = (rawApps ?? []).map((a: {
    id: string; user_id: string; kind: ApplicationKind; status: ApplicationStatus
    data: Record<string, unknown>; admin_note: string | null
    created_at: string; decided_at: string | null
    profiles: { full_name: string | null; phone: string | null } | null
  }) => ({
    ...a,
    applicant_name: a.profiles?.full_name ?? 'Unknown',
    applicant_phone: a.profiles?.phone ?? null,
  }))

  return <ApplicationsClient initialApps={apps} />
}
