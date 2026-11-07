import { emailLayout, h1, p, infoCard, callLink } from './layout'

const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.gocartng.com'

export function renderAtGate(pl: Record<string, unknown>): { html: string; text: string } {
  const orderCode = String(pl.order_code ?? '')
  const riderPhone = String(pl.rider_phone ?? '')
  const orderId = String(pl.order_id ?? '')

  const html = emailLayout(`
    ${h1('Your rider is at the OOUTH Main Gate')}
    ${p('Please come out now. Your rider is waiting at the <strong>OOUTH Main Gate</strong> and will wait up to 10 minutes.')}
    ${riderPhone ? p(`Call your rider: ${callLink(riderPhone)}`) : ''}
    ${infoCard('Remember to bring your delivery PIN to confirm receipt.')}
    <p style="margin:12px 0 0;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:13px;color:#5B6168;text-align:center">
      Order <strong>${orderCode}</strong> &middot;
      <a href="${APP}/track/${orderId}" style="color:#0B7A47;text-decoration:none">Track →</a>
    </p>
  `)

  const text = [
    `Your rider is at the OOUTH Main Gate — Order ${orderCode}`,
    '',
    'Please come out now. Your rider will wait up to 10 minutes.',
    riderPhone ? `Call your rider: ${riderPhone}` : '',
    `\nTrack: ${APP}/track/${orderId}`,
  ].filter(Boolean).join('\n')

  return { html, text }
}
