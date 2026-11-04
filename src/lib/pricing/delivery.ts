export interface DeliveryPricingSettings {
  id?: number
  base_fare_kobo: number
  per_km_kobo: number
  min_fare_kobo: number
  round_to_kobo: number
  rider_extra_kobo: number
  gocart_extra_kobo: number
  max_distance_m: number
  daily_google_call_cap: number
  updated_at?: string
}

export interface DeliveryPrice {
  okada_fare: number   // kobo — what customer pays
  rider_pay: number    // kobo — what rider earns
  delivery_fee: number // kobo — total platform cost
}

export function calcDeliveryPrice(
  distanceM: number,
  s: DeliveryPricingSettings
): DeliveryPrice {
  const km = distanceM / 1000
  const raw = s.base_fare_kobo + s.per_km_kobo * km
  const okada_fare = Math.max(
    s.min_fare_kobo,
    Math.ceil(raw / s.round_to_kobo) * s.round_to_kobo
  )
  const rider_pay = okada_fare + s.rider_extra_kobo
  const delivery_fee = okada_fare + s.rider_extra_kobo + s.gocart_extra_kobo
  return { okada_fare, rider_pay, delivery_fee }
}

// Browser-side haversine estimate (no server call)
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

export function estimateDeliveryDistance(
  vendorLat: number, vendorLng: number,
  pinLat: number, pinLng: number
): number {
  return Math.round(haversineMeters(vendorLat, vendorLng, pinLat, pinLng) * 1.35)
}
