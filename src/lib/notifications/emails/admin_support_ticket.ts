import { emailLayout, h1, p, infoCard, button } from './layout'

const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.gocartng.com'

export function renderAdminSupportTicket(pl: Record<string, unknown>): { html: string; text: string } {
  const customerEmail = String(pl.customer_email ?? 'Unknown')
  const customerName = String(pl.customer_name ?? '').trim()
  const subject = String(pl.subject ?? '')
  const body = String(pl.body ?? '')
  const orderCode = String(pl.order_code ?? '').trim()

  const html = emailLayout(`
    ${h1('New support ticket')}
    ${p(`A customer has submitted a support request.`)}
    ${infoCard(`
      ${customerName ? `<strong>Name:</strong> ${customerName}<br>` : ''}
      <strong>Email:</strong> ${customerEmail}<br>
      <strong>Subject:</strong> ${subject}<br>
      ${orderCode ? `<strong>Order:</strong> ${orderCode}<br>` : ''}
      <br><strong>Message:</strong><br>
      ${body.replace(/\n/g, '<br>')}
    `)}
    ${button(`${APP}/admin`, 'Go to admin')}
  `)

  const text = [
    'New support ticket',
    '',
    customerName ? `Name: ${customerName}` : '',
    `Email: ${customerEmail}`,
    `Subject: ${subject}`,
    orderCode ? `Order: ${orderCode}` : '',
    '',
    'Message:',
    body,
    '',
    `Admin: ${APP}/admin`,
  ].filter(s => s !== undefined && s !== '').join('\n')

  return { html, text }
}
