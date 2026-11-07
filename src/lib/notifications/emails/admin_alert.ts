import { emailLayout, h1, p, button } from './layout'

export function renderAdminAlert(pl: Record<string, unknown>): { html: string; text: string } {
  const title = String(pl.title ?? 'Alert')
  const message = String(pl.message ?? '')
  const url = pl.url ? String(pl.url) : ''
  const actionLabel = String(pl.action_label ?? 'View')

  const html = emailLayout(`
    ${h1(title)}
    ${p(message)}
    ${url ? button(url, actionLabel) : ''}
  `)

  const text = [
    title,
    '',
    message,
    url ? `\n${actionLabel}: ${url}` : '',
  ].filter(Boolean).join('\n')

  return { html, text }
}
