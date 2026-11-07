import { emailLayout, h1, p, infoCard, naira } from './layout'

export function renderPayout(pl: Record<string, unknown>): { html: string; text: string } {
  const recipientName = String(pl.recipient_name ?? '')
  const amount = Number(pl.amount ?? 0)
  const period = String(pl.period ?? '')
  const orderCount = Number(pl.order_count ?? 0)
  const bankName = String(pl.bank_name ?? '')
  const accountName = String(pl.account_name ?? '')
  const reference = String(pl.reference ?? '')

  const html = emailLayout(`
    ${h1('Payout sent')}
    ${p(`Hi <strong>${recipientName}</strong>, your payout of <strong>${naira(amount)}</strong>${period ? ` for ${period}` : ''} has been sent.`)}
    ${infoCard(`
      <strong>Amount:</strong> ${naira(amount)}<br>
      ${orderCount > 0 ? `<strong>Orders:</strong> ${orderCount}<br>` : ''}
      ${bankName ? `<strong>Bank:</strong> ${bankName}<br>` : ''}
      ${accountName ? `<strong>Account:</strong> ${accountName}<br>` : ''}
      ${reference ? `<strong>Reference:</strong> ${reference}` : ''}
    `)}
    ${p('Funds usually arrive within 1 business day. Reply to this email if you have any questions.', true)}
  `)

  const text = [
    `Payout sent — ${naira(amount)}`,
    '',
    `Hi ${recipientName}, your payout of ${naira(amount)}${period ? ` for ${period}` : ''} has been sent.`,
    '',
    orderCount > 0 ? `Orders: ${orderCount}` : '',
    bankName ? `Bank: ${bankName}` : '',
    accountName ? `Account: ${accountName}` : '',
    reference ? `Reference: ${reference}` : '',
    '',
    'Funds usually arrive within 1 business day.',
  ].filter(Boolean).join('\n')

  return { html, text }
}
