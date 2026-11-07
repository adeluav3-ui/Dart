import { describe, it, expect } from 'vitest'
import { findCoveringArea } from './coverageCircles'
import type { Area } from '@/types/database'

function makeArea(overrides: Partial<Area> = {}): Area {
  return {
    id: 'test-id',
    zone_id: null,
    name: 'Test Area',
    district: null,
    aliases: [],
    lat: 6.7073,
    lng: 3.8858,
    accuracy_m: null,
    pin_saved_at: null,
    pin_saved_by: null,
    gate_pickup: false,
    status: 'active',
    is_active: true,
    sort_order: 0,
    created_at: '2024-01-01T00:00:00Z',
    radius_m: 800,
    ...overrides,
  }
}

describe('findCoveringArea', () => {
  it('point inside radius returns the area', () => {
    const area = makeArea({ lat: 6.7073, lng: 3.8858, radius_m: 800 })
    // ~16m from pin — well inside 800m
    const result = findCoveringArea(6.7074, 3.8859, [area])
    expect(result).toBe(area)
  })

  it('point outside all circles returns null', () => {
    const area = makeArea({ lat: 6.7073, lng: 3.8858, radius_m: 800 })
    // ~11km north — far outside 800m
    const result = findCoveringArea(6.8073, 3.8858, [area])
    expect(result).toBeNull()
  })
})
