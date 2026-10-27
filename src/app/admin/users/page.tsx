import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { UsersClient } from './UsersClient'
import type { Zone } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const supabase = createClient()
  const admin = createAdminClient()

  const [
    { data: profilesData },
    { data: { users: authUsers } },
    { data: zonesData },
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name, phone, role, created_at').order('created_at', { ascending: false }),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from('zones').select('id, name').eq('is_active', true).order('name'),
  ])

  const emailMap = Object.fromEntries((authUsers ?? []).map(u => [u.id, u.email ?? '']))

  const users = (profilesData ?? []).map(p => ({
    ...p,
    email: emailMap[p.id] ?? '',
  }))

  return (
    <UsersClient
      users={users}
      zones={(zonesData as Zone[]) ?? []}
    />
  )
}
