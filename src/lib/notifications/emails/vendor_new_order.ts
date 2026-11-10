import { emailLayout, h1, p, button, divider, naira, infoCard } from './layout'

const FONT = "'Plus Jakarta Sans', Arial, Helvetica, sans-serif"
const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.gocartng.com'

export function renderVendorNewOrder(pl: Record<string, unknown>): { html: string; text: string } {
  const orderCode = String(pl.order_code ?? '')
  const items = (pl.items as Array<{ name: string; qty: number; options?: string; line_total: number }>) ?? []
  const subtotal = Number(pl.subtotal ?? 0)
  const total = Number(pl.total ?? 0)
  const deliveryLabel = String(pl.delivery_label ?? '')
  const phone = String(pl.phone ?? '')

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

  const html = emailLayout(`
    ${h1('New order: ' + orderCode)}
    ${p('A new paid order has come in. Accept it on your board before it times out.')}
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:4px 0 16px">${itemRows}</table>
    ${divider()}
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px">
      <tr><td style="padding:4px 0;font-family:${FONT};font-size:13px;color:#5B6168">Subtotal</td><td style="padding:4px 0;text-align:right;font-family:${FONT};font-size:13px;color:#15171A">${naira(subtotal)}</td></tr>
      <tr style="border-top:1px solid #E6E8EB"><td style="padding:8px 0 0;font-family:${FONT};font-size:14px;font-weight:700;color:#15171A">Order total</td><td style="padding:8px 0 0;text-align:right;font-family:${FONT};font-size:14px;font-weight:700;color:#15171A">${naira(total)}</td></tr>
    </table>
    ${deliveryLabel ? infoCard(`<strong>Delivering to:</strong> ${deliveryLabel}`) : ''}
    ${phone ? p(`<strong>Customer phone:</strong> ${phone}`) : ''}
    ${button(`${APP}/vendor`, 'View order on board')}
  `)

  const text = [
    `New order: ${orderCode}`,
    '',
    items.map(i => `${i.qty}x ${i.name}: ${naira(i.line_total)}`).join('\n'),
    '',
    `Subtotal: ${naira(subtotal)}`,
    `Order total: ${naira(total)}`,
    deliveryLabel ? `\nDelivering to: ${deliveryLabel}` : '',
    phone ? `Customer phone: ${phone}` : '',
    `\nView your board: ${APP}/vendor`,
  ].filter(Boolean).join('\n')

  return { html, text }
}
