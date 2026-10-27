/**
 * Normalize a Nigerian phone number to E.164 format (+234XXXXXXXXXX).
 * Accepts: 0803..., 803..., +234803...
 * Returns null if the input cannot be normalized.
 */
export function normalizePhone(raw: string): string | null {
  const stripped = raw.trim().replace(/\s+/g, '').replace(/-/g, '')
  let digits: string

  if (stripped.startsWith('+234')) {
    digits = stripped.slice(4)
  } else if (stripped.startsWith('234')) {
    digits = stripped.slice(3)
  } else if (stripped.startsWith('0')) {
    digits = stripped.slice(1)
  } else {
    digits = stripped
  }

  if (!/^\d{10}$/.test(digits)) return null
  if (!/^[789]/.test(digits)) return null

  return '+234' + digits
}

/** Returns true if the raw input is a valid Nigerian mobile number. */
export function validatePhone(raw: string): boolean {
  return normalizePhone(raw) !== null
}
