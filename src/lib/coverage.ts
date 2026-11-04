import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'
import type { CoverageArea } from '@/types/database'

/**
 * Returns the name of the coverage area the pin falls inside, or null if outside all.
 * Caller is responsible for the zero-areas fallback: if areas.length === 0, skip the check.
 */
export function isInsideCoverage(lat: number, lng: number, areas: CoverageArea[]): string | null {
  const pt = point([lng, lat]) // GeoJSON uses [lng, lat] order
  for (const area of areas) {
    if (!area.is_active) continue
    if (!area.polygon || !area.polygon.coordinates?.length) continue
    if (booleanPointInPolygon(pt, area.polygon)) {
      return area.name
    }
  }
  return null
}
