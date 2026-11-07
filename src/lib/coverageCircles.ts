import type { Area } from '@/types/database'

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

/**
 * Returns the first Area whose pin is within its radius_m of (lat, lng), or null.
 * Only considers areas with lat, lng, and radius_m set.
 */
export function findCoveringArea(lat: number, lng: number, areas: Area[]): Area | null {
  for (const area of areas) {
    if (area.lat == null || area.lng == null || area.radius_m == null) continue
    if (haversineM(lat, lng, area.lat, area.lng) <= area.radius_m) return area
  }
  return null
}
