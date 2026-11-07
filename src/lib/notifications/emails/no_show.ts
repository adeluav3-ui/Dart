import { emailLayout, h1, p, infoCard } from './layout'

const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.gocartng.com'

export function renderNoShow(pl: Record<string, unknown>): { html: string; text: string } {
  const orderCode = String(pl.order_code ?? '')
  const orderId = String(pl.order_id ?? '')
  const vendorName = String(pl.vendor_name ?? '')

  const html = emailLayout(`
    ${h1('We couldn\'t deliver your order')}
    ${p(`Your rider arrived at the gate with your order <strong>${orderCode}</strong> from <strong>${vendorName}</strong>, but couldn't reach you in time.`)}
    ${infoCard('Your order has been returned to the vendor. Please contact us if you believe this was an error.')}
    <p style="margin:16px 0 0;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:14px;color:#15171A;text-align:center">
      <a href="${APP}/track/${orderId}" style="color:#0B7A47;text-decoration:none">View order →</a>
    </p>
  `)

  const text = [
    `Order ${orderCode} — Delivery unsuccessful`,
    '',
    `Your rider arrived at the gate with your order from ${vendorName} but couldn't reach you.`,
    '',
    'The order has been returned to the vendor. Contact us if you think this was a mistake.',
    `\nView order: ${APP}/track/${orderId}`,
  ].join('\n')

  return { html, text }
}
