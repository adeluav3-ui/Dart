import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

let vapidSet = false

function ensureVapid() {
  if (vapidSet) return
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv || pub.startsWith('your-')) return
  webpush.setVapidDetails(
    `mailto:${process.env.ADMIN_EMAIL ?? 'adeluav3@gmail.com'}`,
    pub,
    priv
  )
  vapidSet = true
}

export async function sendVendorPush(vendorOwnerId: string, payload: object) {
  ensureVapid()
  if (!vapidSet) return // skip if VAPID not configured yet
  const admin = createAdminClient()

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key')
    .eq('user_id', vendorOwnerId)

  if (!subs?.length) return

  const message = JSON.stringify(payload)
  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        message
      ).catch(err => {
        // Remove dead subscriptions (410 Gone)
        if (err.statusCode === 410) {
          admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
      })
    )
  )
}
