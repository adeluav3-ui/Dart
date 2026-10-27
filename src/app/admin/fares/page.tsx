'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/format'
import type { Zone, ZoneFare, FareLevel } from '@/types/database'

export default function AdminFaresPage() {
  const [zones, setZones] = useState<Zone[]>([])
  const [fares, setFares] = useState<ZoneFare[]>([])
  const [levels, setLevels] = useState<FareLevel[]>([])
  const [levelEdits, setLevelEdits] = useState<Record<string, { delivery_fee: string; rider_pay: string }>>({})
  const [savingLevel, setSavingLevel] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    Promise.all([
      supabase.from('zones').select('id, name, is_active').eq('is_active', true).order('name'),
      supabase.from('zone_fares').select('*'),
      supabase.from('fare_levels').select('*').order('sort_order'),
    ]).then(([{ data: z }, { data: f }, { data: l }]) => {
      setZones((z ?? []) as Zone[])
      setFares((f ?? []) as ZoneFare[])
      setLevels((l ?? []) as FareLevel[])
    })
  }, [])

  function getFare(aId: string, bId: string): ZoneFare | undefined {
    const [za, zb] = [aId, bId].sort()
    return fares.find(f => f.zone_a === za && f.zone_b === zb)
  }

  async function setFareLevel(aId: string, bId: string, levelId: string) {
    const [zone_a, zone_b] = [aId, bId].sort()
    const existing = getFare(aId, bId)
    const value = levelId === '' ? null : levelId

    if (existing) {
      await supabase.from('zone_fares').update({ fare_level_id: value }).eq('id', existing.id)
      setFares(p => p.map(f => f.id === existing.id ? { ...f, fare_level_id: value } : f))
    } else {
      const { data } = await supabase
        .from('zone_fares')
        .insert({ zone_a, zone_b, fare_level_id: value, is_serviceable: value !== null })
        .select()
        .single()
      if (data) setFares(p => [...p, data as ZoneFare])
    }
  }

  async function toggleServiceable(aId: string, bId: string) {
    const existing = getFare(aId, bId)
    if (!existing) return
    const next = !existing.is_serviceable
    await supabase.from('zone_fares').update({ is_serviceable: next }).eq('id', existing.id)
    setFares(p => p.map(f => f.id === existing.id ? { ...f, is_serviceable: next } : f))
  }

  function getLevelEdit(level: FareLevel) {
    if (levelEdits[level.id]) return levelEdits[level.id]
    return {
      delivery_fee: String(level.delivery_fee / 100),
      rider_pay: String(level.rider_pay / 100),
    }
  }

  function setLevelEdit(id: string, field: 'delivery_fee' | 'rider_pay', val: string) {
    setLevelEdits(p => ({
      ...p,
      [id]: { ...(p[id] ?? getLevelEdit(levels.find(l => l.id === id)!)), [field]: val },
    }))
  }

  async function saveLevel(level: FareLevel) {
    const edit = getLevelEdit(level)
    const delivery_fee = Math.round(parseFloat(edit.delivery_fee || '0') * 100)
    const rider_pay = Math.round(parseFloat(edit.rider_pay || '0') * 100)
    setSavingLevel(level.id)
    await supabase.from('fare_levels').update({ delivery_fee, rider_pay }).eq('id', level.id)
    setLevels(p => p.map(l => l.id === level.id ? { ...l, delivery_fee, rider_pay } : l))
    setLevelEdits(p => { const n = { ...p }; delete n[level.id]; return n })
    setSavingLevel(null)
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <h2 className="font-heading font-bold text-xl">Fares</h2>

      {/* Fare levels */}
      <div className="bg-white rounded-2xl p-4 flex flex-col gap-4">
        <div>
          <h3 className="font-bold text-sm">Fare levels</h3>
          <p className="text-xs text-ink-2 mt-0.5">Each route pair uses one of these levels. Changing a level updates all routes using it.</p>
        </div>
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-ink-2 border-b border-line">
                <th className="pb-2 font-semibold pr-3">Level</th>
                <th className="pb-2 font-semibold pr-3">Customer pays (₦)</th>
                <th className="pb-2 font-semibold pr-3">Rider earns (₦)</th>
                <th className="pb-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {levels.map(level => {
                const edit = getLevelEdit(level)
                const isDirty = !!levelEdits[level.id]
                return (
                  <tr key={level.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-3 font-semibold whitespace-nowrap">{level.name}</td>
                    <td className="py-2.5 pr-3">
                      <input
                        type="number"
                        step="50"
                        value={edit.delivery_fee}
                        onChange={e => setLevelEdit(level.id, 'delivery_fee', e.target.value)}
                        className="w-24 h-8 px-2 rounded-lg border border-line text-sm font-body"
                      />
                    </td>
                    <td className="py-2.5 pr-3">
                      <input
                        type="number"
                        step="50"
                        value={edit.rider_pay}
                        onChange={e => setLevelEdit(level.id, 'rider_pay', e.target.value)}
                        className="w-24 h-8 px-2 rounded-lg border border-line text-sm font-body"
                      />
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        disabled={!isDirty || savingLevel === level.id}
                        onClick={() => saveLevel(level)}
                        className="h-8 px-3 rounded-lg bg-brand text-white text-xs font-bold border-0 disabled:opacity-40"
                      >
                        {savingLevel === level.id ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Zone matrix */}
      {zones.length > 0 && (
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-4">
          <div>
            <h3 className="font-bold text-sm">Route matrix</h3>
            <p className="text-xs text-ink-2 mt-0.5">Assign a fare level to each zone pair. Toggle the switch to enable/disable that route.</p>
          </div>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="text-[13px] border-collapse">
              <thead>
                <tr>
                  <th className="w-24 pr-2 pb-2 text-left text-[11px] text-ink-2 font-semibold"></th>
                  {zones.map(z => (
                    <th key={z.id} className="pb-2 px-1 text-[11px] text-ink-2 font-semibold text-center whitespace-nowrap min-w-[90px]">
                      {z.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zones.map((rowZone, ri) => (
                  <tr key={rowZone.id}>
                    <td className="pr-2 py-1.5 font-semibold text-[13px] whitespace-nowrap align-middle">{rowZone.name}</td>
                    {zones.map((colZone, ci) => {
                      if (ci < ri) {
                        // Mirror — show same cell as (ci, ri)
                        return <td key={colZone.id} className="px-1 py-1.5 bg-surface/40" />
                      }
                      const fare = getFare(rowZone.id, colZone.id)
                      return (
                        <td key={colZone.id} className="px-1 py-1.5 align-middle">
                          <div className="flex flex-col gap-1 items-center">
                            <select
                              value={fare?.fare_level_id ?? ''}
                              onChange={e => setFareLevel(rowZone.id, colZone.id, e.target.value)}
                              className="w-full h-7 px-1.5 rounded-lg border border-line text-[12px] font-body bg-white"
                            >
                              <option value="">—</option>
                              {levels.map(l => (
                                <option key={l.id} value={l.id}>{l.name}</option>
                              ))}
                            </select>
                            {fare && (
                              <button
                                type="button"
                                role="switch"
                                aria-checked={fare.is_serviceable}
                                onClick={() => toggleServiceable(rowZone.id, colZone.id)}
                                className={`relative w-8 h-4 rounded-full border-0 cursor-pointer transition-colors ${fare.is_serviceable ? 'bg-brand' : 'bg-[#C3C8CD]'}`}
                              >
                                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${fare.is_serviceable ? 'left-4' : 'left-0.5'}`} />
                              </button>
                            )}
                            {fare?.fare_level_id && (
                              <span className="text-[10px] text-ink-2 whitespace-nowrap">
                                {formatMoney(levels.find(l => l.id === fare.fare_level_id)?.delivery_fee ?? 0)}
                              </span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
