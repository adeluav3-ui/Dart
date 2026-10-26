const formatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** Format kobo integer as ₦3,500 */
export function formatMoney(kobo: number): string {
  return formatter.format(kobo / 100)
}

/** Format a date/time in Africa/Lagos timezone */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    timeZone: 'Africa/Lagos',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    timeZone: 'Africa/Lagos',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

/** Normalise a Nigerian phone number to +234XXXXXXXXXX */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('234')) return '+' + digits
  if (digits.startsWith('0')) return '+234' + digits.slice(1)
  if (digits.length === 10) return '+234' + digits
  return '+' + digits
}

export function isValidNigerianPhone(raw: string): boolean {
  const normalised = normalisePhone(raw)
  return /^\+234[789][01]\d{8}$/.test(normalised)
}
