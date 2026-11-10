import { emailLayout, h1, p, button, infoCard } from './layout'

const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.gocartng.com'

export function renderAdminVendorSilent(pl: Record<string, unknown>): { html: string; text: string } {
  const orderCode  = String(pl.order_code  ?? '')
  const vendorName = String(pl.vendor_name ?? '')
  const paidAt     = String(pl.paid_at     ?? '')

  const html = emailLayout(`
    ${h1('Vendor not responding: ' + orderCode)}
    ${p(`<strong>${vendorName}</strong> has not accepted order <strong>${orderCode}</strong> for more than 5 minutes.`)}
    ${paidAt ? infoCard(`Payment confirmed at ${paidAt}`) : ''}
    ${p('The order will auto-cancel at 10 minutes if not accepted. You may want to call the vendor.')}
    ${button(`${APP}/admin/orders`, 'View orders')}
  `)

  const text = [
    `Vendor not responding: ${orderCode}`,
    '',
    `${vendorName} has not accepted ${orderCode} for more than 5 minutes.`,
    paidAt ? `Payment confirmed at ${paidAt}` : '',
    '',
    'The order will auto-cancel at 10 minutes if not accepted.',
    `\nView orders: ${APP}/admin/orders`,
  ].filter(Boolean).join('\n')

  return { html, text }
}
