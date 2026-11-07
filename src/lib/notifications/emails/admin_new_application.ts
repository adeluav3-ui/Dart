import { emailLayout, h1, p, infoCard, button } from './layout'

const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.gocartng.com'

export function renderAdminNewApplication(pl: Record<string, unknown>): { html: string; text: string } {
  const vendorName = String(pl.vendor_name ?? '')
  const applicantName = String(pl.applicant_name ?? '')
  const applicantPhone = String(pl.applicant_phone ?? '')
  const vendorType = String(pl.vendor_type ?? '')
  const vendorId = String(pl.vendor_id ?? '')

  const typeLabel = vendorType === 'restaurant' ? 'Restaurant'
    : vendorType === 'supermarket' ? 'Supermarket'
    : vendorType === 'pharmacy' ? 'Pharmacy'
    : vendorType

  const html = emailLayout(`
    ${h1('New vendor application')}
    ${p(`A new vendor has signed up and is waiting for approval.`)}
    ${infoCard(`
      <strong>Store name:</strong> ${vendorName}<br>
      ${typeLabel ? `<strong>Type:</strong> ${typeLabel}<br>` : ''}
      ${applicantName ? `<strong>Owner:</strong> ${applicantName}<br>` : ''}
      ${applicantPhone ? `<strong>Phone:</strong> ${applicantPhone}` : ''}
    `)}
    ${vendorId ? button(`${APP}/admin/vendors/${vendorId}`, 'Review application') : button(`${APP}/admin/vendors`, 'Review vendors')}
  `)

  const text = [
    `New vendor application — ${vendorName}`,
    '',
    'A new vendor has signed up and is waiting for approval.',
    '',
    `Store: ${vendorName}`,
    typeLabel ? `Type: ${typeLabel}` : '',
    applicantName ? `Owner: ${applicantName}` : '',
    applicantPhone ? `Phone: ${applicantPhone}` : '',
    vendorId
      ? `\nReview: ${APP}/admin/vendors/${vendorId}`
      : `\nReview vendors: ${APP}/admin/vendors`,
  ].filter(Boolean).join('\n')

  return { html, text }
}
