import { describe, it, expect } from 'vitest'
import { isInsideCoverage } from './coverage'
import type { CoverageArea } from '@/types/database'

// A 0.01° × 0.01° square centred ~6.70 N, 3.89 E (Sagamu area)
const square: CoverageArea['polygon'] = {
  type: 'Polygon',
  coordinates: [[
    [3.885, 6.695],
    [3.895, 6.695],
    [3.895, 6.705],
    [3.885, 6.705],
    [3.885, 6.695],
  ]],
}

const activeArea: CoverageArea = {
  id: 'area-1',
  name: 'Test Zone',
  polygon: square,
  is_active: true,
  created_at: '',
  updated_at: '',
}

const inactiveArea: CoverageArea = { ...activeArea, id: 'area-2', is_active: false }

describe('isInsideCoverage', () => {
  it('returns area name when point is inside the polygon', () => {
    // Centre of the square
    expect(isInsideCoverage(6.70, 3.89, [activeArea])).toBe('Test Zone')
  })

  it('returns null when point is outside the polygon', () => {
    // Well outside
    expect(isInsideCoverage(6.80, 3.89, [activeArea])).toBeNull()
  })

  it('returns null for empty areas array', () => {
    expect(isInsideCoverage(6.70, 3.89, [])).toBeNull()
  })

  it('skips inactive areas', () => {
    expect(isInsideCoverage(6.70, 3.89, [inactiveArea])).toBeNull()
  })

  it('skips areas with null polygon', () => {
    const noPolygon: CoverageArea = { ...activeArea, polygon: null }
    expect(isInsideCoverage(6.70, 3.89, [noPolygon])).toBeNull()
  })

  it('returns name when inside one of multiple areas', () => {
    const second: CoverageArea = {
      ...activeArea,
      id: 'area-3',
      name: 'Other Zone',
      polygon: {
        type: 'Polygon',
        coordinates: [[
          [3.900, 6.695],
          [3.910, 6.695],
          [3.910, 6.705],
          [3.900, 6.705],
          [3.900, 6.695],
        ]],
      },
    }
    // Inside first area
    expect(isInsideCoverage(6.70, 3.89, [activeArea, second])).toBe('Test Zone')
    // Inside second area
    expect(isInsideCoverage(6.70, 3.905, [activeArea, second])).toBe('Other Zone')
  })
})
