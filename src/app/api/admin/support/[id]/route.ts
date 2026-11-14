import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupportTicketStatus } from '@/types/database'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { status?: SupportTicketStatus; admin_note?: string }
  const { status, admin_note } = body

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('support_tickets')
    .update({
      ...(status ? { status } : {}),
      admin_note: admin_note ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select('status, admin_note, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, updated: data })
}
