import { createAdminClient } from '@/lib/supabase/admin'
import { SupportClient } from './SupportClient'
import type { SupportTicketStatus } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function AdminSupportPage() {
  const admin = createAdminClient()

  const { data: raw } = await admin
    .from('support_tickets')
    .select('*, profiles(full_name, phone), orders(code)')
    .order('created_at', { ascending: false })

  // Fetch emails from auth.users for each unique user_id
  const userIds = [...new Set((raw ?? []).map((t: { user_id: string | null }) => t.user_id).filter(Boolean) as string[])]
  const emailMap: Record<string, string> = {}
  await Promise.all(
    userIds.map(async (uid) => {
      const { data } = await admin.auth.admin.getUserById(uid)
      if (data.user?.email) emailMap[uid] = data.user.email
    })
  )

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
    profiles: { full_name: string | null; phone: string | null } | null
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
    customer_name: t.profiles?.full_name ?? null,
    customer_phone: t.profiles?.phone ?? null,
    customer_email: t.user_id ? (emailMap[t.user_id] ?? null) : null,
    order_code: t.orders?.code ?? null,
  }))

  return <SupportClient initialTickets={tickets} />
}
