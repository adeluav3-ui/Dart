import { emailLayout, h1, p, infoCard } from './layout'

export function renderVendorMissed(pl: Record<string, unknown>): { html: string; text: string } {
  const orderCode = String(pl.order_code ?? '')
  const vendorName = String(pl.vendor_name ?? '')
  const autoRejectedAt = String(pl.auto_rejected_at ?? '')

  const html = emailLayout(`
    ${h1('Order timed out')}
    ${p(`Order <strong>${orderCode}</strong> was not accepted within 10 minutes and has been automatically cancelled${autoRejectedAt ? ` at ${autoRejectedAt}` : ''}.`)}
    ${infoCard('The customer has been refunded. To avoid timeouts, keep your GoCart tab open and your sound on when you\'re accepting orders.')}
    ${p(`If you believe this was an error, please reply to this email and we'll look into it.`, true)}
  `)

  const text = [
    `Order ${orderCode} timed out — ${vendorName}`,
    '',
    `Order ${orderCode} was not accepted within 10 minutes and has been auto-cancelled.`,
    autoRejectedAt ? `Cancelled at: ${autoRejectedAt}` : '',
    '',
    'The customer has been refunded.',
    '',
    "To avoid this, keep your GoCart tab open with sound on. Reply to this email if you need help.",
  ].filter(Boolean).join('\n')

  return { html, text }
}
