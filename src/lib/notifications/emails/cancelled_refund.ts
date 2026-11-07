import { emailLayout, h1, p, infoCard, naira } from './layout'

export function renderCancelledRefund(pl: Record<string, unknown>): { html: string; text: string } {
  const orderCode = String(pl.order_code ?? '')
  const vendorName = String(pl.vendor_name ?? '')
  const amount = Number(pl.amount ?? 0)
  const destination = String(pl.refund_destination ?? 'card')

  const refundMsg = destination === 'wallet'
    ? `${naira(amount)} has been added to your GoCart credit and will apply automatically to your next order.`
    : `${naira(amount)} is on its way back to your card or bank. This usually takes 3–5 business days.`

  const html = emailLayout(`
    ${h1('Order cancelled')}
    ${p(`We're sorry — <strong>${vendorName}</strong> wasn't able to take your order <strong>${orderCode}</strong>.`)}
    ${infoCard(`<strong>Refund:</strong> ${refundMsg}`)}
    ${p('If you have any questions, reply to this email and we\'ll sort it out.', true)}
  `)

  const text = [
    `Order ${orderCode} was cancelled`,
    '',
    `${vendorName} couldn't take your order.`,
    '',
    `Refund: ${refundMsg}`,
    '',
    "Questions? Reply to this email.",
  ].join('\n')

  return { html, text }
}
