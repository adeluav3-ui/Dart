import { describe, it, expect } from 'vitest'
import { calcDeliveryPrice, type DeliveryPricingSettings } from './delivery'

const settings: DeliveryPricingSettings = {
  base_fare_kobo: 15000,
  per_km_kobo: 12500,
  min_fare_kobo: 20000,
  round_to_kobo: 5000,
  rider_extra_kobo: 10000,
  gocart_extra_kobo: 10000,
  max_distance_m: 6000,
  daily_google_call_cap: 400,
}

const cases: [number, number][] = [
  [300, 200],
  [700, 250],
  [1000, 300],
  [1400, 350],
  [1900, 400],
  [2700, 500],
  [4500, 750],
]

describe('calcDeliveryPrice', () => {
  it.each(cases)('%dm → ₦%d okada fare', (distanceM, expectedNaira) => {
    const { okada_fare } = calcDeliveryPrice(distanceM, settings)
    expect(okada_fare).toBe(expectedNaira * 100)
  })
})
