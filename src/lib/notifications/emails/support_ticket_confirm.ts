import { emailLayout, h1, p, infoCard, divider } from './layout'

export function renderSupportTicketConfirm(pl: Record<string, unknown>): { html: string; text: string } {
  const name = String(pl.name ?? '').trim()
  const subject = String(pl.subject ?? '')
  const body = String(pl.body ?? '')
  const orderCode = String(pl.order_code ?? '').trim()

  const html = emailLayout(`
    ${h1(`We got your message${name ? `, ${name}` : ''}`)}
    ${p("Thanks for reaching out. Our support team will get back to you within 2 working days.")}
    ${infoCard(`
      <strong>Your message:</strong> ${subject}<br><br>
      ${body.replace(/\n/g, '<br>')}
      ${orderCode ? `<br><br><strong>Order:</strong> ${orderCode}` : ''}
    `)}
    ${divider()}
    ${p('You can also reply directly to this email and we\'ll see it.', true)}
  `)

  const text = [
    `We got your message${name ? `, ${name}` : ''}`,
    '',
    'Thanks for reaching out. Our support team will get back to you within 2 working days.',
    '',
    `Your message: ${subject}`,
    body,
    orderCode ? `\nOrder: ${orderCode}` : '',
    '',
    'You can also reply directly to this email and we\'ll see it.',
  ].filter(s => s !== undefined).join('\n')

  return { html, text }
}
