import { emailLayout, h1, p, button } from './layout'

const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.gocartng.com'

export function renderApproved(pl: Record<string, unknown>): { html: string; text: string } {
  const vendorName = String(pl.vendor_name ?? '')
  const ownerName = String(pl.owner_name ?? '')

  const html = emailLayout(`
    ${h1('You\'re live on GoCart!')}
    ${p(`Congratulations${ownerName ? `, <strong>${ownerName}</strong>` : ''}! <strong>${vendorName}</strong> has been approved and is now live on GoCart.`)}
    ${p('Customers in Sagamu can now find and order from your store. Make sure your menu is complete and your open/closed switch is on when you\'re ready.')}
    ${button(`${APP}/vendor`, 'Go to your dashboard')}
  `)

  const text = [
    `${vendorName} is live on GoCart!`,
    '',
    `Congratulations${ownerName ? ` ${ownerName}` : ''}! Your store has been approved and is now live.`,
    '',
    "Customers in Sagamu can now find and order from you.",
    "Make sure your menu is ready and your store is set to open.",
    `\nDashboard: ${APP}/vendor`,
  ].join('\n')

  return { html, text }
}
