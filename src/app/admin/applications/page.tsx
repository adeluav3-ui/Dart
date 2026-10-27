import { createAdminClient } from '@/lib/supabase/admin'
import { ApplicationsClient } from './ApplicationsClient'

export default async function AdminApplicationsPage() {
  const admin = createAdminClient()

  const { data: rawApps } = await admin
    .from('applications')
    .select('*, profiles(full_name, phone)')
    .order('created_at', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apps = (rawApps ?? []).map((a: any) => ({
    ...a,
    applicant_name: a.profiles?.full_name ?? 'Unknown',
    applicant_phone: a.profiles?.phone ?? null,
  }))

  return <ApplicationsClient initialApps={apps} />
}
