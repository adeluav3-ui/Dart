'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Zone, ZoneFare } from '@/types/database'

export default function AdminZonesPage() {
  const [zones, setZones] = useState<Zone[]>([])
  const [fares, setFares] = useState<ZoneFare[]>([])
  const [zoneName, setZoneName] = useState('')
  const [saving, setSaving] = useState(false)
  const [fareEdit, setFareEdit] = useState<Record<string, { delivery_fee: string; rider_pay: string }>>({})
  const supabase = createClient()

  useEffect(() => {
    supabase.from('zones').select('id, name, is_active').order('name').then(({ data }) => setZones((data ?? []) as Zone[]))
    supabase.from('zone_fares').select('*').then(({ data }) => {
      setFares((data ?? []) as ZoneFare[])
    })
  }, [])

  async function addZone() {
    if (!zoneName.trim()) return
    setSaving(true)
    const { data } = await supabase.from('zones').insert({ name: zoneName.trim() }).select('id, name, is_active').single()
    if (data) { setZones(p => [...p, data as Zone]); setZoneName('') }
    setSaving(false)
  }

  async function toggleActive(zone: Zone) {
    await supabase.from('zones').update({ is_active: !zone.is_active }).eq('id', zone.id)
    setZones(prev => prev.map(z => z.id === zone.id ? { ...z, is_active: !z.is_active } : z))
  }

  // Canonical pair key: smaller zone_id first
  function pairKey(a: string, b: string) {
    const [za, zb] = [a, b].sort()
    return `${za}__${zb}`
  }

  function getFare(a: string, b: string): ZoneFare | undefined {
    const [za, zb] = [a, b].sort()
    return fares.find(f => f.zone_a === za && f.zone_b === zb)
  }

  function getEdit(a: string, b: string) {
    const key = pairKey(a, b)
    if (fareEdit[key]) return fareEdit[key]
    const existing = getFare(a, b)
    return {
      delivery_fee: existing ? String(existing.delivery_fee / 100) : '',
      rider_pay: existing ? String(existing.rider_pay / 100) : '',
    }
  }

  function setEdit(a: string, b: string, field: 'delivery_fee' | 'rider_pay', val: string) {
    const key = pairKey(a, b)
    setFareEdit(p => ({ ...p, [key]: { ...getEdit(a, b), [field]: val } }))
  }

  async function saveFare(a: string, b: string) {
    const edit = getEdit(a, b)
    const delivery_fee = Math.round(parseFloat(edit.delivery_fee || '0') * 100)
    const rider_pay = Math.round(parseFloat(edit.rider_pay || '0') * 100)
    const [zone_a, zone_b] = [a, b].sort()

    const existing = getFare(a, b)
    if (existing) {
      await supabase.from('zone_fares').update({ delivery_fee, rider_pay }).eq('id', existing.id)
      setFares(p => p.map(f => f.id === existing.id ? { ...f, delivery_fee, rider_pay } : f))
    } else {
      const { data } = await supabase.from('zone_fares').insert({ zone_a, zone_b, delivery_fee, rider_pay }).select().single()
      if (data) setFares(p => [...p, data as ZoneFare])
    }

    const key = pairKey(a, b)
    setFareEdit(p => { const n = { ...p }; delete n[key]; return n })
  }

  async function toggleServiceable(a: string, b: string) {
    const existing = getFare(a, b)
    if (!existing) return
    const next = !existing.is_serviceable
    await supabase.from('zone_fares').update({ is_serviceable: next }).eq('id', existing.id)
    setFares(p => p.map(f => f.id === existing.id ? { ...f, is_serviceable: next } : f))
  }

  const activeZones = zones.filter(z => z.is_active)

  // Build unique unordered pairs (including same-zone)
  type Pair = { a: Zone; b: Zone; same: boolean }
  const pairs: Pair[] = []
  for (let i = 0; i < activeZones.length; i++) {
    for (let j = i; j < activeZones.length; j++) {
      pairs.push({ a: activeZones[i], b: activeZones[j], same: i === j })
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <h2 className="font-heading font-bold text-xl">Zones &amp; Fares</h2>

      {/* Add zone */}
      <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
        <h3 className="font-bold text-sm">Add zone</h3>
        <div className="flex gap-2">
          <div className="flex-1 min-w-0">
            <Input
              label=""
              placeholder="Zone name (e.g. Central)"
              value={zoneName}
              onChange={e => setZoneName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addZone()}
            />
          </div>
          <Button onClick={addZone} loading={saving}>Add</Button>
        </div>
      </div>

      {/* Zone list */}
      <div className="bg-white rounded-2xl p-4 flex flex-col gap-2">
        <h3 className="font-bold text-sm">Zones</h3>
        {zones.map(zone => (
          <div key={zone.id} className="flex items-center gap-3 py-1.5">
            <span className="flex-1 min-w-0 text-sm font-semibold truncate">{zone.name}</span>
            <button
              type="button"
              role="switch"
              aria-checked={zone.is_active}
              onClick={() => toggleActive(zone)}
              className={`relative w-11 h-6 rounded-full border-0 cursor-pointer transition-colors shrink-0 ${zone.is_active ? 'bg-brand' : 'bg-[#C3C8CD]'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${zone.is_active ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        ))}
      </div>

      {/* Zone fares grid */}
      {activeZones.length >= 1 && (
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-4">
          <div>
            <h3 className="font-bold text-sm">Delivery fares</h3>
            <p className="text-xs text-ink-2 mt-0.5">
              One row per zone pair (including same-zone delivery). Toggle to enable ordering between zones.
            </p>
          </div>
          {pairs.map(({ a, b, same }) => {
            const edit = getEdit(a.id, b.id)
            const existing = getFare(a.id, b.id)
            const key = pairKey(a.id, b.id)
            const isDirty = !!fareEdit[key]
            return (
              <div key={key} className="flex flex-col gap-2 py-3 border-b border-line last:border-0">
                {/* Pair header + serviceable toggle */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold min-w-0 truncate">
                    {same ? `${a.name} → ${a.name}` : `${a.name} ↔ ${b.name}`}
                  </span>
                  {existing && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-ink-2">{existing.is_serviceable ? 'Serving' : 'Off'}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={existing.is_serviceable}
                        onClick={() => toggleServiceable(a.id, b.id)}
                        className={`relative w-9 h-5 rounded-full border-0 cursor-pointer transition-colors ${existing.is_serviceable ? 'bg-brand' : 'bg-[#C3C8CD]'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${existing.is_serviceable ? 'left-4' : 'left-0.5'}`} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Two inputs side by side */}
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-ink-2">Delivery (₦)</span>
                    <input
                      type="number"
                      step="50"
                      value={edit.delivery_fee}
                      onChange={e => setEdit(a.id, b.id, 'delivery_fee', e.target.value)}
                      placeholder="0"
                      className="h-9 px-2 rounded-lg border border-line text-sm font-body w-full"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-ink-2">Rider pay (₦)</span>
                    <input
                      type="number"
                      step="50"
                      value={edit.rider_pay}
                      onChange={e => setEdit(a.id, b.id, 'rider_pay', e.target.value)}
                      placeholder="0"
                      className="h-9 px-2 rounded-lg border border-line text-sm font-body w-full"
                    />
                  </label>
                </div>

                {/* Save button full width */}
                <button
                  type="button"
                  onClick={() => saveFare(a.id, b.id)}
                  disabled={!isDirty && !!existing}
                  className="h-9 w-full rounded-lg bg-brand text-white text-sm font-bold border-0 disabled:opacity-40"
                >
                  {existing ? 'Update' : 'Set fare'}
                </button>

                {existing && !isDirty && (
                  <span className="text-xs text-ink-2">
                    {formatMoney(existing.delivery_fee)} delivery · {formatMoney(existing.rider_pay)} rider pay
                    {!existing.is_serviceable && <span className="ml-2 text-warn font-semibold">· Not serving</span>}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
