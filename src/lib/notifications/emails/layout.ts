const FONT = "'Plus Jakarta Sans', Arial, Helvetica, sans-serif"
const LOGO = 'https://gclflzbdguuitdxuhyeo.supabase.co/storage/v1/object/public/email/gocart-email-logo-v2.png'

export function naira(kobo: number): string {
  return '₦' + new Intl.NumberFormat('en-US').format(Math.round(kobo / 100))
}

export function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>GoCart</title>
</head>
<body style="margin:0;padding:0;background:#F6F7F5">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F6F7F5">
  <tr>
    <td align="center" style="padding:32px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px">
        <!-- Header -->
        <tr>
          <td style="background:#0B7A47;border-radius:16px 16px 0 0;padding:28px 24px;text-align:center">
            <img src="${LOGO}" width="150" height="auto" alt="GoCart" style="display:block;margin:0 auto;border:0">
          </td>
        </tr>
        <!-- Card -->
        <tr>
          <td style="background:#ffffff;padding:32px 24px;border-radius:0 0 16px 16px">
            ${content}
          </td>
        </tr>
        <!-- Spacer -->
        <tr><td style="height:20px"></td></tr>
        <!-- Footer -->
        <tr>
          <td style="text-align:center;padding:0 8px">
            <p style="margin:0 0 6px;font-family:${FONT};font-size:13px;line-height:1.5;color:#5B6168">
              Need help? Reply to this email or write to
              <a href="mailto:support@gocartng.com" style="color:#0B7A47;text-decoration:none">support@gocartng.com</a>
            </p>
            <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.5;color:#5B6168">
              GoCart &middot; Sagamu, Ogun State, Nigeria &middot;
              <a href="https://gocartng.com" style="color:#0B7A47;text-decoration:none">gocartng.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

export function h1(text: string): string {
  return `<h1 style="margin:0 0 16px;font-family:${FONT};font-size:22px;font-weight:800;line-height:1.3;color:#15171A">${text}</h1>`
}

export function p(text: string, muted = false): string {
  const color = muted ? '#5B6168' : '#15171A'
  return `<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.6;color:${color}">${text}</p>`
}

export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px">
    <tr>
      <td style="border-radius:14px;background:#0B7A47">
        <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:14px">${label}</a>
      </td>
    </tr>
  </table>`
}

export function divider(): string {
  return `<div style="height:1px;background:#E6E8EB;margin:16px 0"></div>`
}

export function pin(code: string): string {
  return `<div style="text-align:center;padding:16px 0 20px">
    <div style="display:inline-block;font-family:${FONT};font-size:42px;font-weight:800;letter-spacing:10px;color:#0B7A47">${code}</div>
  </div>`
}

export function callLink(phone: string): string {
  return `<a href="tel:${phone}" style="color:#0B7A47;text-decoration:none;font-weight:700">${phone}</a>`
}

export function infoCard(text: string): string {
  return `<div style="background:#E7F4EC;border-radius:12px;padding:14px 16px;margin:12px 0;font-family:${FONT};font-size:14px;line-height:1.5;color:#0A4F30">${text}</div>`
}
