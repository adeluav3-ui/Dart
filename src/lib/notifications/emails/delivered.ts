import { emailLayout, h1, p, button, divider, naira } from './layout'

const FONT = "'Plus Jakarta Sans', Arial, Helvetica, sans-serif"
const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.gocartng.com'

export function renderDelivered(pl: Record<string, unknown>): { html: string; text: string } {
  const orderCode = String(pl.order_code ?? '')
  const vendorName = String(pl.vendor_name ?? '')
  const items = (pl.items as Array<{ name: string; qty: number; options?: string; line_total: number }>) ?? []
  const subtotal = Number(pl.subtotal ?? 0)
  const deliveryFee = Number(pl.delivery_fee ?? 0)
  const serviceFee = Number(pl.service_fee ?? 0)
  const total = Number(pl.total ?? 0)
  const deliveredAt = String(pl.delivered_at ?? '')
  const orderId = String(pl.order_id ?? '')

  const itemRows = items.map(item => `
    <tr>
      <td style="padding:5px 0;font-family:${FONT};font-size:14px;color:#15171A">
        <strong>${item.qty}&times;</strong> ${item.name}
        ${item.options ? `<br><span style="color:#5B6168;font-size:12px">${item.options}</span>` : ''}
      </td>
      <td style="padding:5px 0;text-align:right;font-family:${FONT};font-size:14px;color:#15171A;white-space:nowrap">
        ${naira(item.line_total)}
      </td>
    </tr>`).join('')

  const feeRows = [
    `<tr><td style="padding:4px 0;font-family:${FONT};font-size:13px;color:#5B6168">Items</td><td style="padding:4px 0;text-align:right;font-family:${FONT};font-size:13px">${naira(subtotal)}</td></tr>`,
    deliveryFee > 0 ? `<tr><td style="padding:4px 0;font-family:${FONT};font-size:13px;color:#5B6168">Delivery</td><td style="padding:4px 0;text-align:right;font-family:${FONT};font-size:13px">${naira(deliveryFee)}</td></tr>` : '',
    serviceFee > 0 ? `<tr><td style="padding:4px 0;font-family:${FONT};font-size:13px;color:#5B6168">Service fee</td><td style="padding:4px 0;text-align:right;font-family:${FONT};font-size:13px">${naira(serviceFee)}</td></tr>` : '',
    `<tr style="border-top:1px solid #E6E8EB"><td style="padding:8px 0 0;font-family:${FONT};font-size:14px;font-weight:700">Total paid</td><td style="padding:8px 0 0;text-align:right;font-family:${FONT};font-size:14px;font-weight:700">${naira(total)}</td></tr>`,
  ].join('')

  const html = emailLayout(`
    ${h1('Delivered. Enjoy!')}
    ${p(`Order <strong>${orderCode}</strong> from <strong>${vendorName}</strong> was delivered${deliveredAt ? ` at ${deliveredAt}` : ''}. We hope you enjoy it!`)}
    ${divider()}
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px">${itemRows}</table>
    ${divider()}
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px">${feeRows}</table>
    ${button(`${APP}/rate/${orderId}`, 'Rate your order')}
  `)

  const text = [
    `Delivered — Order ${orderCode}`,
    deliveredAt ? `Delivered at: ${deliveredAt}` : '',
    '',
    items.map(i => `${i.qty}x ${i.name}: ${naira(i.line_total)}`).join('\n'),
    `\nTotal paid: ${naira(total)}`,
    `\nRate your order: ${APP}/rate/${orderId}`,
  ].filter(Boolean).join('\n')

  return { html, text }
}
