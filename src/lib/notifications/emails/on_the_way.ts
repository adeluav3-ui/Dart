import { emailLayout, h1, p, pin, infoCard, callLink, naira } from './layout'

const FONT = "'Plus Jakarta Sans', Arial, Helvetica, sans-serif"
const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.gocartng.com'

export function renderOnTheWay(pl: Record<string, unknown>): { html: string; text: string } {
  const orderCode = String(pl.order_code ?? '')
  const riderFirstName = String(pl.rider_first_name ?? 'Your rider')
  const riderPhone = String(pl.rider_phone ?? '')
  const deliveryPin = String(pl.pin ?? '')
  const deliveryLabel = String(pl.delivery_label ?? '')
  const orderId = String(pl.order_id ?? '')

  const html = emailLayout(`
    ${h1('Your order is on the way')}
    ${p(`<strong>${riderFirstName}</strong> has picked up your order <strong>${orderCode}</strong> and is heading to you.`)}
    ${riderPhone ? p(`Need to reach them? Call: ${callLink(riderPhone)}`) : ''}
    ${deliveryLabel ? p(`<strong>Delivering to:</strong> ${deliveryLabel}`) : ''}
    <p style="margin:16px 0 4px;font-family:${FONT};font-size:14px;font-weight:700;color:#15171A;text-align:center">Your delivery PIN</p>
    ${pin(deliveryPin)}
    ${infoCard('Give the rider your PIN <strong>only when your order is in your hand</strong>. This confirms delivery.')}
    <p style="margin:12px 0 0;font-family:${FONT};font-size:13px;color:#5B6168;text-align:center">
      <a href="${APP}/track/${orderId}" style="color:#0B7A47;text-decoration:none">Track your order →</a>
    </p>
  `)

  const text = [
    `Your order ${orderCode} is on the way`,
    '',
    `${riderFirstName} has picked up your order and is coming to you.`,
    riderPhone ? `Call your rider: ${riderPhone}` : '',
    deliveryLabel ? `Delivering to: ${deliveryLabel}` : '',
    '',
    `Your delivery PIN: ${deliveryPin}`,
    '',
    'Give the rider your PIN only when your order is in your hand.',
    `\nTrack: ${APP}/track/${orderId}`,
  ].filter(Boolean).join('\n')

  return { html, text }
}
