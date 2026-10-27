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

  const profileMap = Object.fromEntries((profilesData ?? []).map(p => [p.id, p]))

  // Auth users are the source of truth — profiles may be missing for early signups
  const users = (authUsers ?? []).map(u => ({
    id: u.id,
    email: u.email ?? '',
    full_name: profileMap[u.id]?.full_name
      ?? u.user_metadata?.full_name
      ?? u.user_metadata?.name
      ?? null,
    phone: profileMap[u.id]?.phone ?? u.user_metadata?.phone ?? null,
    role: (profileMap[u.id]?.role ?? 'customer') as import('@/types/database').UserRole,
    created_at: u.created_at,
  })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <UsersClient
      users={users}
      zones={(zonesData as Zone[]) ?? []}
    />
  )
}
