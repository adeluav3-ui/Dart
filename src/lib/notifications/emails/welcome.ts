import { emailLayout, h1, p, button, divider } from './layout'

const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.gocartng.com'

export function renderWelcome(pl: Record<string, unknown>): { html: string; text: string } {
  const name = String(pl.name ?? '').trim()

  const html = emailLayout(`
    ${h1(`Welcome to GoCart${name ? `, ${name}` : ''}!`)}
    ${p('Your account is ready. You can now order food from restaurants, groceries from supermarkets, and medicines from pharmacies — all delivered to your landmark in Sagamu.')}
    ${button(`${APP}/home`, 'Start ordering')}
    ${divider()}
    ${p('<strong>How it works:</strong> Browse shops → add items → pay securely → a rider brings it to you. Confirm with your 4-digit PIN.', true)}
  `)

  const text = [
    `Welcome to GoCart${name ? `, ${name}` : ''}!`,
    '',
    'Your account is ready.',
    '',
    'Order food, groceries or pharmacy items and get them delivered to your landmark in Sagamu.',
    '',
    `Start ordering: ${APP}/home`,
  ].join('\n')

  return { html, text }
}
