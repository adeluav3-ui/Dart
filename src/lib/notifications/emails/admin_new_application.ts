import { emailLayout, h1, p, infoCard, button } from './layout'

const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.gocartng.com'

export function renderAdminNewApplication(pl: Record<string, unknown>): { html: string; text: string } {
  const kind = String(pl.kind ?? 'vendor')
  const isRider = kind === 'rider'
  const vendorName = String(pl.vendor_name ?? '')
  const applicantName = String(pl.applicant_name ?? '')
  const applicantPhone = String(pl.applicant_phone ?? '')
  const vendorType = String(pl.vendor_type ?? '')
  const vendorId = String(pl.vendor_id ?? '')

  const typeLabel = vendorType === 'restaurant' ? 'Restaurant'
    : vendorType === 'supermarket' ? 'Supermarket'
    : vendorType === 'pharmacy' ? 'Pharmacy'
    : vendorType === 'rider' ? 'Rider'
    : vendorType

  const heading = isRider ? 'New rider application' : 'New vendor application'
  const intro = isRider
    ? 'A new rider has applied and is waiting for review.'
    : 'A new vendor has signed up and is waiting for approval.'

  const nameLabel = isRider ? 'Name' : 'Store name'
  const reviewUrl = isRider
    ? `${APP}/admin/riders`
    : (vendorId ? `${APP}/admin/vendors/${vendorId}` : `${APP}/admin/vendors`)
  const reviewLabel = isRider ? 'Review riders' : (vendorId ? 'Review application' : 'Review vendors')

  const html = emailLayout(`
    ${h1(heading)}
    ${p(intro)}
    ${infoCard(`
      <strong>${nameLabel}:</strong> ${vendorName}<br>
      ${typeLabel ? `<strong>Type:</strong> ${typeLabel}<br>` : ''}
      ${applicantName && !isRider ? `<strong>Owner:</strong> ${applicantName}<br>` : ''}
      ${applicantPhone ? `<strong>Phone:</strong> ${applicantPhone}` : ''}
    `)}
    ${button(reviewUrl, reviewLabel)}
  `)

  const text = [
    `${heading} — ${vendorName}`,
    '',
    intro,
    '',
    `${nameLabel}: ${vendorName}`,
    typeLabel ? `Type: ${typeLabel}` : '',
    applicantName && !isRider ? `Owner: ${applicantName}` : '',
    applicantPhone ? `Phone: ${applicantPhone}` : '',
    `\nReview: ${reviewUrl}`,
  ].filter(Boolean).join('\n')

  return { html, text }
}
