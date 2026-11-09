import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderTemplate } from '@/lib/notifications/emails'

export async function POST(req: NextRequest) {
  // Admin-only
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('roles').eq('id', user.id).single()
  if (!profile?.roles?.includes('admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { event, channel, payload } = await req.json()
  if (!event || !channel) {
    return NextResponse.json({ error: 'event and channel required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Get the admin's email
  const { data: authUser } = await admin.auth.admin.getUserById(user.id)
  const adminEmail = authUser.user?.email ?? null

  // Check env vars before even inserting
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.EMAIL_FROM
  if (channel === 'email') {
    if (!resendKey) return NextResponse.json({ error: 'RESEND_API_KEY is not set in Vercel env vars' }, { status: 500 })
    if (!fromEmail) return NextResponse.json({ error: 'EMAIL_FROM is not set in Vercel env vars' }, { status: 500 })
    if (!adminEmail) return NextResponse.json({ error: 'Admin account has no email address' }, { status: 500 })
  }

  // Insert notification
  const { data: row, error: insertErr } = await admin
    .from('notifications')
    .insert({
      event,
      recipient_user_id: user.id,
      recipient_email: channel === 'email' ? adminEmail : null,
      recipient_role: 'admin',
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

  if (insertErr || !row) {
    return NextResponse.json({ error: insertErr?.message ?? 'Insert failed' }, { status: 500 })
  }

  // Dispatch inline — no HTTP hop
  if (channel === 'email') {
    const subject = payload?.email_subject ?? `Test: ${event}`
    const template = payload?.email_template as string | undefined
    const rendered = template ? renderTemplate(template, payload ?? {}) : null
    const html = rendered?.html ?? `<p>${payload?.body ?? 'Test notification'}</p>`
    const text = rendered?.text ?? (payload?.body as string ?? 'Test notification')

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({ from: fromEmail, to: adminEmail, subject, html, text }),
    })

    if (!resendRes.ok) {
      const resendBody = await resendRes.text().catch(() => '')
      await admin.from('notifications')
        .update({ status: 'failed', last_error: `Resend ${resendRes.status}: ${resendBody}`, attempts: 1 })
        .eq('id', row.id)
      return NextResponse.json({
        ok: false,
        id: row.id,
        error: `Resend rejected the email: ${resendRes.status}`,
        detail: resendBody,
        hint: resendRes.status === 403
          ? 'Domain not verified in Resend, or API key lacks send permissions'
          : resendRes.status === 422
          ? 'EMAIL_FROM address/domain is not verified in Resend'
          : 'Check Resend dashboard for details',
      }, { status: 500 })
    }

    await admin.from('notifications')
      .update({ status: 'sent', sent_at: new Date().toISOString(), attempts: 1 })
      .eq('id', row.id)

    return NextResponse.json({ ok: true, id: row.id, sent_to: adminEmail })
  }

  return NextResponse.json({ ok: true, id: row.id })
}
