import { createAdminClient } from '@/lib/supabase/admin'
import { SupportClient } from './SupportClient'
import type { SupportTicketStatus } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function AdminSupportPage() {
  const admin = createAdminClient()

  // user_id references auth.users, not profiles — no FK join available.
  // Fetch tickets and orders separately, then merge profile + email data.
  const { data: raw } = await admin
    .from('support_tickets')
    .select('*, orders(code)')
    .order('created_at', { ascending: false })

  const userIds = Array.from(
    new Set((raw ?? []).map((t: { user_id: string | null }) => t.user_id).filter(Boolean) as string[])
  )

  // Fetch profile (name, phone) and email in parallel for each user
  const [profileRows, authUsers] = await Promise.all([
    userIds.length > 0
      ? admin.from('profiles').select('id, full_name, phone').in('id', userIds).then(r => r.data ?? [])
      : Promise.resolve([]),
    Promise.all(
      userIds.map(uid => admin.auth.admin.getUserById(uid).then(r => ({ uid, email: r.data.user?.email ?? null })))
    ),
  ])

  const profileMap = Object.fromEntries(
    (profileRows as { id: string; full_name: string | null; phone: string | null }[]).map(p => [p.id, p])
  )
  const emailMap = Object.fromEntries(authUsers.map(({ uid, email }) => [uid, email]))

  const tickets = (raw ?? []).map((t: {
    id: string
    user_id: string | null
    order_id: string | null
    subject: string
    body: string
    status: SupportTicketStatus
    admin_note: string | null
    created_at: string
    updated_at: string
    orders: { code: string } | null
  }) => ({
    id: t.id,
    user_id: t.user_id,
    order_id: t.order_id,
    subject: t.subject,
    body: t.body,
    status: t.status,
    admin_note: t.admin_note,
    created_at: t.created_at,
    updated_at: t.updated_at,
    customer_name: t.user_id ? (profileMap[t.user_id]?.full_name ?? null) : null,
    customer_phone: t.user_id ? (profileMap[t.user_id]?.phone ?? null) : null,
    customer_email: t.user_id ? (emailMap[t.user_id] ?? null) : null,
    order_code: t.orders?.code ?? null,
  }))

  return <SupportClient initialTickets={tickets} />
}
