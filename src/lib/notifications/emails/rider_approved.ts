import { emailLayout, h1, p, button } from './layout'

const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.gocartng.com'

export function renderRiderApproved(pl: Record<string, unknown>): { html: string; text: string } {
  const name = String(pl.rider_name ?? '')

  const html = emailLayout(`
    ${h1('You\'re a GoCart rider!')}
    ${p(`Welcome${name ? `, <strong>${name}</strong>` : ''}! Your rider application has been approved.`)}
    ${p('Open the app, go to your rider dashboard, and turn on your availability to start receiving delivery jobs.')}
    ${button(`${APP}/rider`, 'Open rider dashboard')}
  `)

  const text = [
    "You're a GoCart rider!",
    '',
    `Welcome${name ? ` ${name}` : ''}! Your rider application has been approved.`,
    '',
    'Open the app and go to your rider dashboard to start receiving jobs.',
    `\nDashboard: ${APP}/rider`,
  ].join('\n')

  return { html, text }
}
