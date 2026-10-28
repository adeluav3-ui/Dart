export interface ServiceFeeSettings {
  enabled: boolean
  type: 'percent' | 'flat'
  percent: number  // integer e.g. 5
  min: number      // kobo
  max: number      // kobo
  flat: number     // kobo
}

export function parseServiceFeeSettings(
  rows: { key: string; value: string }[]
): ServiceFeeSettings {
  const get = (key: string, fallback: string) =>
    rows.find(r => r.key === key)?.value ?? fallback
  return {
    enabled: get('service_fee_enabled', 'true') !== 'false',
    type: get('service_fee_type', 'percent') === 'flat' ? 'flat' : 'percent',
    percent: parseInt(get('service_fee_percent', '5'), 10),
    min: parseInt(get('service_fee_min', '10000'), 10),
    max: parseInt(get('service_fee_max', '50000'), 10),
    flat: parseInt(get('service_fee_flat', '15000'), 10),
  }
}

// Server-side only. subtotal in kobo. Returns fee in kobo.
export function calcServiceFee(subtotal: number, s: ServiceFeeSettings): number {
  if (!s.enabled || subtotal <= 0) return 0
  if (s.type === 'flat') return s.flat
  const raw = Math.round(subtotal * s.percent / 100)
  const clamped = Math.min(Math.max(raw, s.min), s.max)
  // Round to nearest ₦10 (1 000 kobo)
  return Math.round(clamped / 1000) * 1000
}
