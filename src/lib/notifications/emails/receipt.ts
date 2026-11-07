import { emailLayout, h1, p, button, divider, naira } from './layout'

const FONT = "'Plus Jakarta Sans', Arial, Helvetica, sans-serif"
const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.gocartng.com'

export function renderReceipt(pl: Record<string, unknown>): { html: string; text: string } {
  const orderCode = String(pl.order_code ?? '')
  const vendorName = String(pl.vendor_name ?? '')
  const items = (pl.items as Array<{ name: string; qty: number; options?: string; line_total: number }>) ?? []
  const subtotal = Number(pl.subtotal ?? 0)
  const deliveryFee = Number(pl.delivery_fee ?? 0)
  const serviceFee = Number(pl.service_fee ?? 0)
  const total = Number(pl.total ?? 0)
  const deliveryLabel = String(pl.delivery_label ?? '')
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
    `<tr><td style="padding:4px 0;font-family:${FONT};font-size:13px;color:#5B6168">Items</td><td style="padding:4px 0;text-align:right;font-family:${FONT};font-size:13px;color:#15171A">${naira(subtotal)}</td></tr>`,
    deliveryFee > 0 ? `<tr><td style="padding:4px 0;font-family:${FONT};font-size:13px;color:#5B6168">Delivery</td><td style="padding:4px 0;text-align:right;font-family:${FONT};font-size:13px;color:#15171A">${naira(deliveryFee)}</td></tr>` : '',
    serviceFee > 0 ? `<tr><td style="padding:4px 0;font-family:${FONT};font-size:13px;color:#5B6168">Service fee</td><td style="padding:4px 0;text-align:right;font-family:${FONT};font-size:13px;color:#15171A">${naira(serviceFee)}</td></tr>` : '',
    `<tr style="border-top:1px solid #E6E8EB"><td style="padding:8px 0 0;font-family:${FONT};font-size:14px;font-weight:700;color:#15171A">Total paid</td><td style="padding:8px 0 0;text-align:right;font-family:${FONT};font-size:14px;font-weight:700;color:#15171A">${naira(total)}</td></tr>`,
  ].join('')

  const html = emailLayout(`
    ${h1('Order confirmed')}
    ${p(`Your order <strong>${orderCode}</strong> from <strong>${vendorName}</strong> is confirmed. We've sent it to the kitchen.`)}
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:4px 0 16px">${itemRows}</table>
    ${divider()}
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px">${feeRows}</table>
    ${deliveryLabel ? p(`<strong>Delivering to:</strong> ${deliveryLabel}`) : ''}
    ${button(`${APP}/track/${orderId}`, 'Track your order')}
  `)

  const text = [
    `Order ${orderCode} confirmed — ${vendorName}`,
    '',
    items.map(i => `${i.qty}x ${i.name}: ${naira(i.line_total)}`).join('\n'),
    '',
    `Items: ${naira(subtotal)}`,
    deliveryFee > 0 ? `Delivery: ${naira(deliveryFee)}` : '',
    serviceFee > 0 ? `Service fee: ${naira(serviceFee)}` : '',
    `Total paid: ${naira(total)}`,
    deliveryLabel ? `\nDelivering to: ${deliveryLabel}` : '',
    `\nTrack your order: ${APP}/track/${orderId}`,
  ].filter(Boolean).join('\n')

  return { html, text }
}
