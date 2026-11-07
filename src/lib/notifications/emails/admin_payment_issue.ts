import { emailLayout, h1, p, infoCard, button, naira } from './layout'

const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.gocartng.com'

export function renderAdminPaymentIssue(pl: Record<string, unknown>): { html: string; text: string } {
  const orderCode = String(pl.order_code ?? '')
  const orderId = String(pl.order_id ?? '')
  const amount = Number(pl.amount ?? 0)
  const issue = String(pl.issue ?? '')
  const reference = String(pl.reference ?? '')

  const html = emailLayout(`
    ${h1('Payment issue')}
    ${p(`A payment issue was detected on order <strong>${orderCode}</strong> and needs your attention.`)}
    ${infoCard(`
      <strong>Order:</strong> ${orderCode}<br>
      ${amount > 0 ? `<strong>Amount:</strong> ${naira(amount)}<br>` : ''}
      ${reference ? `<strong>Reference:</strong> ${reference}<br>` : ''}
      <strong>Issue:</strong> ${issue}
    `)}
    ${orderId ? button(`${APP}/admin/orders/${orderId}`, 'Review order') : ''}
  `)

  const text = [
    `Payment issue — Order ${orderCode}`,
    '',
    `A payment issue was detected on order ${orderCode}.`,
    '',
    amount > 0 ? `Amount: ${naira(amount)}` : '',
    reference ? `Reference: ${reference}` : '',
    `Issue: ${issue}`,
    orderId ? `\nReview: ${APP}/admin/orders/${orderId}` : '',
  ].filter(Boolean).join('\n')

  return { html, text }
}
