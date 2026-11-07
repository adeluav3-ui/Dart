import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  // Admin-only
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { event, channel, payload } = await req.json()
  if (!event || !channel) {
    return NextResponse.json({ error: 'event and channel required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Enqueue directly (bypass enqueue_notification to avoid Vault dependency in test)
  const { data: row, error } = await admin
    .from('notifications')
    .insert({
      event,
      recipient_user_id: user.id,
      channel,
      title: payload?.title ?? `Test: ${event}`,
      body: payload?.body ?? 'This is a test notification from GoCart.',
      url: payload?.url ?? null,
      email_subject: payload?.email_subject ?? `Test: ${event}`,
      email_template: payload?.email_template ?? null,
      payload: payload ?? {},
      status: 'pending',
      send_after: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
  }

  // Kick dispatcher
  const dispatchUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/internal/notifications/dispatch`
  await fetch(dispatchUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-dispatch-secret': process.env.INTERNAL_DISPATCH_SECRET ?? '',
    },
    body: JSON.stringify({ id: row.id }),
  }).catch(() => null)

  return NextResponse.json({ ok: true, id: row.id })
}
