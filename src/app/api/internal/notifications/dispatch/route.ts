import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { renderTemplate } from '@/lib/notifications/emails'

export const runtime = 'nodejs'
export const maxDuration = 30

// ── Supabase admin client (service role) ─────────────────────────────────────
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// ── VAPID ─────────────────────────────────────────────────────────────────────
webpush.setVapidDetails(
  `mailto:${process.env.ADMIN_EMAIL ?? 'support@gocartng.com'}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

// ── Resend (email) ────────────────────────────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const FROM_EMAIL = process.env.EMAIL_FROM ?? 'GoCart <orders@gocartng.com>'
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? '')
  .split(',').map(e => e.trim()).filter(Boolean)

async function sendEmail(to: string, subject: string, html: string, text: string) {
  if (!RESEND_API_KEY) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html, text }),
  })
}

// ── Termii (SMS) ──────────────────────────────────────────────────────────────
const TERMII_API_KEY = process.env.TERMII_API_KEY ?? ''
const TERMII_SENDER_ID = process.env.TERMII_SENDER_ID ?? 'GoCart'

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('234')) return digits
  if (digits.startsWith('0') && digits.length === 11) return '234' + digits.slice(1)
  if (digits.length === 10) return '234' + digits
  return digits
}

async function sendSms(to: string, message: string): Promise<void> {
  if (!TERMII_API_KEY) return
  await fetch('https://api.ng.termii.com/api/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: TERMII_API_KEY,
      to,
      from: TERMII_SENDER_ID,
      sms: message,
      type: 'plain',
      channel: 'generic',
    }),
  })
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Notification {
  id: string
  event: string
  order_id: string | null
  recipient_user_id: string | null
  recipient_email: string | null
  recipient_role: string | null
  channel: string
  title: string | null
  body: string | null
  url: string | null
  email_subject: string | null
  email_template: string | null
  payload: Record<string, unknown>
  attempts: number
}

interface PushSubscription {
  id: string
  endpoint: string
  p256dh: string
  auth_key: string
}

// ── Skip conditions ───────────────────────────────────────────────────────────
const ORDER_MUST_BE_PAID = new Set(['vendor_new_order', 'admin_vendor_silent'])
const ORDER_MUST_BE_ACTIVE = new Set(['admin_no_rider'])

async function shouldSkip(n: Notification): Promise<boolean> {
  if (!n.order_id) return false
  if (ORDER_MUST_BE_PAID.has(n.event)) {
    const { data } = await supabaseAdmin
      .from('orders').select('status').eq('id', n.order_id).single()
    return data?.status !== 'paid'
  }
  if (ORDER_MUST_BE_ACTIVE.has(n.event)) {
    const { data } = await supabaseAdmin
      .from('orders').select('status').eq('id', n.order_id).single()
    return !['accepted', 'ready'].includes(data?.status ?? '')
  }
  return false
}

// ── Send push ─────────────────────────────────────────────────────────────────
async function sendPushToSubscription(
  sub: PushSubscription,
  payload: { title: string; body: string; url?: string; tag?: string }
): Promise<'ok' | 'dead' | 'error'> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
      JSON.stringify(payload),
      { TTL: 86400 }
    )
    return 'ok'
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) return 'dead'
    return 'error'
  }
}

async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string }
): Promise<{ sent: number; dead: number }> {
  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key')
    .eq('user_id', userId)

  if (!subs || subs.length === 0) return { sent: 0, dead: 0 }

  let sent = 0, dead = 0
  for (const sub of subs) {
    const result = await sendPushToSubscription(sub, payload)
    if (result === 'ok') {
      sent++
      await supabaseAdmin
        .from('push_subscriptions')
        .update({ last_success_at: new Date().toISOString() })
        .eq('id', sub.id)
    } else if (result === 'dead') {
      dead++
      await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
    }
  }
  return { sent, dead }
}

async function sendPushToRole(
  role: string,
  payload: { title: string; body: string; url?: string; tag?: string }
): Promise<{ sent: number }> {
  const { data: profiles } = await supabaseAdmin
    .from('profiles').select('id').eq('role', role)
  if (!profiles) return { sent: 0 }
  let sent = 0
  for (const p of profiles) {
    const { sent: s } = await sendPushToUser(p.id, payload)
    sent += s
  }
  return { sent }
}

// ── Dispatch one notification ─────────────────────────────────────────────────
async function dispatchOne(n: Notification): Promise<void> {
  // CAS claim — only proceed if attempts hasn't changed under us
  const { count } = await supabaseAdmin
    .from('notifications')
    .update({ attempts: n.attempts + 1, status: 'sending' })
    .eq('id', n.id)
    .eq('attempts', n.attempts)
    .eq('status', 'pending')

  if (!count || count === 0) return // already claimed by another worker

  const skip = await shouldSkip(n)
  if (skip) {
    await supabaseAdmin
      .from('notifications')
      .update({ status: 'skipped', last_error: 'order_state_changed' })
      .eq('id', n.id)
    return
  }

  try {
    if (n.channel === 'push') {
      const pushPayload = {
        title: n.title ?? '',
        body: n.body ?? '',
        url: n.url ?? undefined,
        tag: n.event,
      }

      let sent = 0
      if (n.recipient_user_id) {
        const result = await sendPushToUser(n.recipient_user_id, pushPayload)
        sent = result.sent
        if (result.sent === 0 && result.dead === 0) {
          await supabaseAdmin
            .from('notifications')
            .update({ status: 'skipped', last_error: 'no_subscription' })
            .eq('id', n.id)
          return
        }
      } else if (n.recipient_role) {
        const result = await sendPushToRole(n.recipient_role, pushPayload)
        sent = result.sent
      }

      await supabaseAdmin
        .from('notifications')
        .update({ status: sent > 0 ? 'sent' : 'skipped', sent_at: new Date().toISOString() })
        .eq('id', n.id)

    } else if (n.channel === 'email') {
      const template = n.email_template
      const subject = n.email_subject ?? n.title ?? 'GoCart'

      const rendered = template ? renderTemplate(template, n.payload) : null
      const html = rendered?.html ?? `<p>${n.body ?? ''}</p>`
      const text = rendered?.text ?? (n.body ?? '')

      const recipients: string[] = []
      if (n.recipient_email) recipients.push(n.recipient_email)
      if (n.recipient_role === 'admin') recipients.push(...ADMIN_EMAILS)

      if (recipients.length === 0) {
        await supabaseAdmin
          .from('notifications')
          .update({ status: 'skipped', last_error: 'no_recipient' })
          .eq('id', n.id)
        return
      }

      for (const to of recipients) {
        await sendEmail(to, subject, html, text)
      }

      await supabaseAdmin
        .from('notifications')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', n.id)

    } else if (n.channel === 'sms') {
      if (!n.recipient_user_id) {
        await supabaseAdmin
          .from('notifications')
          .update({ status: 'skipped', last_error: 'no_recipient_user' })
          .eq('id', n.id)
        return
      }

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('phone')
        .eq('id', n.recipient_user_id)
        .single()

      const rawPhone = profile?.phone ?? ''
      const phone = normalizePhone(rawPhone)

      if (!phone || phone.length < 11) {
        await supabaseAdmin
          .from('notifications')
          .update({ status: 'skipped', last_error: 'no_phone' })
          .eq('id', n.id)
        return
      }

      await sendSms(phone, n.body ?? '')
      await supabaseAdmin
        .from('notifications')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', n.id)
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const nextAttempts = n.attempts + 1
    if (nextAttempts >= 3) {
      await supabaseAdmin
        .from('notifications')
        .update({ status: 'failed', last_error: msg })
        .eq('id', n.id)
    } else {
      await supabaseAdmin
        .from('notifications')
        .update({
          status: 'pending',
          last_error: msg,
          send_after: new Date(Date.now() + nextAttempts * 60_000).toISOString(),
        })
        .eq('id', n.id)
    }
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Verify dispatch secret
  const secret = req.headers.get('x-dispatch-secret')
  const expected = process.env.INTERNAL_DISPATCH_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Single notification (immediate dispatch from enqueue_notification)
  const body = await req.json().catch(() => ({})) as { id?: string }
  if (body.id) {
    const { data } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('id', body.id)
      .eq('status', 'pending')
      .lte('send_after', new Date().toISOString())
      .single()
    if (data) await dispatchOne(data as Notification)
    return NextResponse.json({ ok: true })
  }

  // Batch sweep (pg_cron every minute)
  const { data: pending } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('status', 'pending')
    .lte('send_after', new Date().toISOString())
    .lt('attempts', 3)
    .order('send_after')
    .limit(50)

  if (!pending || pending.length === 0) {
    return NextResponse.json({ dispatched: 0 })
  }

  await Promise.allSettled(pending.map(n => dispatchOne(n as Notification)))
  return NextResponse.json({ dispatched: pending.length })
}
