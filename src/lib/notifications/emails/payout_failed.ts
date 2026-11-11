import { emailLayout, h1, p, infoCard, naira } from './layout'

export function renderPayoutFailed(pl: Record<string, unknown>): { html: string; text: string } {
  const recipientName = String(pl.recipient_name ?? '')
  const amount = Number(pl.amount ?? 0)
  const bankName = String(pl.bank_name ?? '')
  const reference = String(pl.reference ?? '')

  const html = emailLayout(`
    ${h1('Payout failed')}
    ${p(`Hi <strong>${recipientName}</strong>, your payout of <strong>${naira(amount)}</strong> could not be completed.`)}
    ${infoCard(`
      <strong>Amount:</strong> ${naira(amount)}<br>
      ${bankName ? `<strong>Bank:</strong> ${bankName}<br>` : ''}
      ${reference ? `<strong>Reference:</strong> ${reference}` : ''}
    `)}
    ${p('Your earnings have <strong>not</strong> been deducted — you can try withdrawing again from the app. If the problem continues, reply to this email and we\'ll look into it.', true)}
  `)

  const text = [
    `Payout failed — ${naira(amount)}`,
    '',
    `Hi ${recipientName}, your payout of ${naira(amount)} could not be completed.`,
    '',
    bankName ? `Bank: ${bankName}` : '',
    reference ? `Reference: ${reference}` : '',
    '',
    "Your earnings have not been deducted — you can try withdrawing again from the app.",
  ].filter(Boolean).join('\n')

  return { html, text }
}
