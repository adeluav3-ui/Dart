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
    admin.from('profiles').select('id, full_name, phone, role, roles, created_at').order('created_at', { ascending: false }),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('zones').select('id, name').eq('is_active', true).order('name'),
  ])

  const profileMap = Object.fromEntries((profilesData ?? []).map(p => [p.id, p]))

  function effectiveRole(p: { role?: string | null; roles?: string[] | null }): import('@/types/database').UserRole {
    const roles = p.roles ?? []
    if (roles.includes('admin')) return 'admin'
    if (roles.includes('vendor')) return 'vendor'
    if (roles.includes('rider')) return 'rider'
    // Fall back to role column in case roles array is missing
    const r = p.role
    if (r === 'admin' || r === 'vendor' || r === 'rider') return r
    return 'customer'
  }

  // Auth users are the source of truth — profiles may be missing for early signups
  const users = (authUsers ?? []).map(u => ({
    id: u.id,
    email: u.email ?? '',
    full_name: profileMap[u.id]?.full_name
      ?? u.user_metadata?.full_name
      ?? u.user_metadata?.name
      ?? null,
    phone: profileMap[u.id]?.phone ?? u.user_metadata?.phone ?? null,
    role: effectiveRole(profileMap[u.id] ?? {}),
    created_at: u.created_at,
  })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <UsersClient
      users={users}
      zones={(zonesData as Zone[]) ?? []}
    />
  )
}
