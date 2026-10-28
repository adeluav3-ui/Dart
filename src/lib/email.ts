import { Resend } from 'resend'
import { formatMoney, formatTime } from '@/lib/format'

const resend = new Resend(process.env.RESEND_API_KEY!)
const FROM = 'Dart Delivery <orders@dartdelivery.ng>'

// ── helpers ──────────────────────────────────────────────────────────────────

function html(body: string) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#15171A;max-width:480px;margin:0 auto;padding:24px">${body}</body></html>`
}

function btn(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;background:#0B7A47;color:#fff;font-weight:700;padding:14px 28px;border-radius:14px;text-decoration:none;margin-top:16px">${label}</a>`
}

// ── email types ───────────────────────────────────────────────────────────────

export async function sendOrderPaidEmail({
  to,
  orderCode,
  deliveryPin,
  subtotal,
  deliveryFee,
  serviceFee,
  total,
  orderId,
}: {
  to: string
  orderCode: string
  deliveryPin: string
  subtotal: number
  deliveryFee: number
  serviceFee: number
  total: number
  orderId: string
}) {
  const feeRows = [
    `<tr><td style="padding:3px 0;color:#5B6168;font-size:13px">Items</td><td style="padding:3px 0;text-align:right;font-size:13px">${formatMoney(subtotal)}</td></tr>`,
    deliveryFee > 0
      ? `<tr><td style="padding:3px 0;color:#5B6168;font-size:13px">Delivery</td><td style="padding:3px 0;text-align:right;font-size:13px">${formatMoney(deliveryFee)}</td></tr>`
      : '',
    serviceFee > 0
      ? `<tr><td style="padding:3px 0;color:#5B6168;font-size:13px">Service fee</td><td style="padding:3px 0;text-align:right;font-size:13px">${formatMoney(serviceFee)}</td></tr>`
      : '',
    `<tr style="border-top:1px solid #E6E8EB"><td style="padding:6px 0 0;font-weight:700;font-size:14px">Total paid</td><td style="padding:6px 0 0;text-align:right;font-weight:700;font-size:14px">${formatMoney(total)}</td></tr>`,
  ].join('')

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Order ${orderCode} confirmed — your code is ${deliveryPin}`,
    html: html(`
      <h2 style="color:#0B7A47;margin-bottom:4px">Payment received!</h2>
      <p>Your order <strong>${orderCode}</strong> is confirmed.</p>
      <p>When your rider arrives, give them this PIN:</p>
      <div style="font-size:40px;font-weight:800;letter-spacing:8px;color:#0B7A47;margin:16px 0">${deliveryPin}</div>
      <table style="width:100%;border-collapse:collapse;margin:8px 0 16px">${feeRows}</table>
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL}/track/${orderId}`, 'Track your order')}
    `),
  })
}

export async function sendRiderAssignedEmail({
  to,
  orderCode,
  riderName,
  riderPhone,
}: {
  to: string
  orderCode: string
  riderName: string
  riderPhone: string
}) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Rider on the way — order ${orderCode}`,
    html: html(`
      <h2>Your rider is on the way</h2>
      <p>Order <strong>${orderCode}</strong></p>
      <p><strong>${riderName}</strong> has picked up your order and is heading to you.</p>
      <p>If you need to reach them: <a href="tel:${riderPhone}">${riderPhone}</a></p>
    `),
  })
}

export async function sendOrderPickedUpEmail({
  to,
  orderCode,
  deliveryPin,
}: {
  to: string
  orderCode: string
  deliveryPin: string
}) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Rider is on the way — order ${orderCode}`,
    html: html(`
      <h2>Your order is on the way!</h2>
      <p>Order <strong>${orderCode}</strong> has been picked up and is heading to you.</p>
      <p>Your delivery PIN:</p>
      <div style="font-size:40px;font-weight:800;letter-spacing:8px;color:#0B7A47;margin:16px 0">${deliveryPin}</div>
      <p style="color:#5B6168;font-size:13px">Give this PIN to your rider to confirm delivery.</p>
    `),
  })
}

export async function sendOrderDeliveredEmail({
  to,
  orderCode,
  orderId,
}: {
  to: string
  orderCode: string
  orderId: string
}) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Order ${orderCode} delivered — how was it?`,
    html: html(`
      <h2>Order delivered!</h2>
      <p>Your order <strong>${orderCode}</strong> has been delivered. Enjoy!</p>
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL}/rate/${orderId}`, 'Leave a review')}
    `),
  })
}

export async function sendRefundEmail({
  to,
  orderCode,
  amount,
}: {
  to: string
  orderCode: string
  amount: number
}) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Refund for order ${orderCode}`,
    html: html(`
      <h2>Refund processed</h2>
      <p>Order <strong>${orderCode}</strong> was cancelled.</p>
      <p><strong>${formatMoney(amount)}</strong> has been added to your Dart wallet and will appear on your next order.</p>
    `),
  })
}

// ── admin alert emails ────────────────────────────────────────────────────────

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'adeluav3@gmail.com'

export async function sendAdminVendorUnresponsiveEmail({
  vendorName,
  orderCode,
  vendorPhone,
}: {
  vendorName: string
  orderCode: string
  vendorPhone: string | null
}) {
  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `⚠️ Vendor hasn't responded — ${orderCode}`,
    html: html(`
      <h2>Vendor not responding</h2>
      <p><strong>${vendorName}</strong> has not accepted or rejected order <strong>${orderCode}</strong> after 3 minutes.</p>
      ${vendorPhone ? `<p>Call them: <a href="tel:${vendorPhone}">${vendorPhone}</a></p>` : ''}
    `),
  })
}

export async function sendAdminNoRiderEmail({
  vendorName,
  orderCode,
}: {
  vendorName: string
  orderCode: string
}) {
  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `⚠️ No rider available — ${orderCode}`,
    html: html(`
      <h2>No rider available</h2>
      <p>Order <strong>${orderCode}</strong> from <strong>${vendorName}</strong> has no rider. The vendor has flagged that no rider is free.</p>
    `),
  })
}

export async function sendAdminVendorReviewEmail({
  vendorName,
  vendorId,
}: {
  vendorName: string
  vendorId: string
}) {
  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New vendor ready for review — ${vendorName}`,
    html: html(`
      <h2>Vendor submitted for review</h2>
      <p><strong>${vendorName}</strong> has completed their setup and is requesting approval.</p>
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL}/admin/review`, 'Review now')}
      <p style="color:#5B6168;font-size:13px">Vendor ID: ${vendorId}</p>
    `),
  })
}

export async function sendAdminItemReviewEmail({
  vendorName,
  itemName,
  vendorId,
}: {
  vendorName: string
  itemName: string
  vendorId: string
}) {
  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `Menu item submitted for review — ${itemName}`,
    html: html(`
      <h2>Item submitted for review</h2>
      <p><strong>${vendorName}</strong> submitted <strong>${itemName}</strong> for review.</p>
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL}/admin/review`, 'Review now')}
      <p style="color:#5B6168;font-size:13px">Vendor ID: ${vendorId}</p>
    `),
  })
}

export async function sendAdminApplicationEmail({
  kind,
  applicantName,
  data,
}: {
  kind: 'vendor' | 'rider'
  applicantName: string
  data: Record<string, unknown>
}) {
  const kindLabel = kind === 'vendor' ? 'Vendor' : 'Rider'
  const dataRows = Object.entries(data)
    .map(([k, v]) => `<tr><td style="padding:4px 8px;color:#5B6168;font-size:13px">${k.replace(/_/g, ' ')}</td><td style="padding:4px 8px;font-size:13px">${String(v)}</td></tr>`)
    .join('')

  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New ${kindLabel} application — ${applicantName}`,
    html: html(`
      <h2>New ${kindLabel.toLowerCase()} application</h2>
      <p><strong>${applicantName}</strong> has applied to ${kind === 'vendor' ? 'sell on' : 'ride with'} Dart.</p>
      <table style="border-collapse:collapse;margin:12px 0">${dataRows}</table>
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL}/admin/applications`, 'Review application')}
    `),
  })
}

export async function sendVendorApprovedEmail({
  to,
  name,
}: {
  to: string
  name: string
}) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Your Dart vendor application was approved!',
    html: html(`
      <h2 style="color:#0B7A47">You're on Dart!</h2>
      <p>Hi ${name}, your vendor application has been approved.</p>
      <p>Sign in to your account, open the Vendor dashboard, and complete your shop setup. Your menu goes live once you've added photos and prices for at least 3 items.</p>
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL}/vendor`, 'Go to vendor dashboard')}
    `),
  })
}

export async function sendRiderApprovedEmail({
  to,
  name,
}: {
  to: string
  name: string
}) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Your Dart rider application was approved!',
    html: html(`
      <h2 style="color:#0B7A47">Welcome to the Dart team!</h2>
      <p>Hi ${name}, your rider application has been approved.</p>
      <p>Sign in to your account and open the Rider dashboard to start accepting jobs.</p>
      ${btn(`${process.env.NEXT_PUBLIC_APP_URL}/rider`, 'Go to rider dashboard')}
    `),
  })
}

export async function sendAdminNoRiderAssignedEmail({
  vendorName,
  orderCode,
  acceptedAt,
}: {
  vendorName: string
  orderCode: string
  acceptedAt: string
}) {
  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `⚠️ No rider assigned 10 min after acceptance — ${orderCode}`,
    html: html(`
      <h2>Rider not assigned</h2>
      <p>Order <strong>${orderCode}</strong> from <strong>${vendorName}</strong> was accepted at ${formatTime(acceptedAt)} but no rider has been assigned after 10 minutes.</p>
    `),
  })
}
