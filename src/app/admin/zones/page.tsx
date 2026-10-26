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

  function fareKey(from: string, to: string) { return `${from}__${to}` }

  function getFare(from: string, to: string): ZoneFare | undefined {
    return fares.find(f => f.from_zone === from && f.to_zone === to)
  }

  function getEdit(from: string, to: string) {
    const key = fareKey(from, to)
    if (fareEdit[key]) return fareEdit[key]
    const existing = getFare(from, to)
    return {
      delivery_fee: existing ? String(existing.delivery_fee / 100) : '',
      rider_pay: existing ? String(existing.rider_pay / 100) : '',
    }
  }

  function setEdit(from: string, to: string, field: 'delivery_fee' | 'rider_pay', val: string) {
    const key = fareKey(from, to)
    setFareEdit(p => ({ ...p, [key]: { ...getEdit(from, to), [field]: val } }))
  }

  async function saveFare(from: string, to: string) {
    const edit = getEdit(from, to)
    const delivery_fee = Math.round(parseFloat(edit.delivery_fee || '0') * 100)
    const rider_pay = Math.round(parseFloat(edit.rider_pay || '0') * 100)

    const existing = getFare(from, to)
    if (existing) {
      await supabase.from('zone_fares').update({ delivery_fee, rider_pay }).eq('id', existing.id)
      setFares(p => p.map(f => f.id === existing.id ? { ...f, delivery_fee, rider_pay } : f))
    } else {
      const { data } = await supabase.from('zone_fares').insert({ from_zone: from, to_zone: to, delivery_fee, rider_pay }).select().single()
      if (data) setFares(p => [...p, data as ZoneFare])
    }

    const key = fareKey(from, to)
    setFareEdit(p => { const n = { ...p }; delete n[key]; return n })
  }

  const activeZones = zones.filter(z => z.is_active)

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <h2 className="font-heading font-bold text-xl">Zones &amp; Fares</h2>

      {/* Add zone */}
      <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
        <h3 className="font-bold text-sm">Add zone</h3>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              label=""
              placeholder="Zone name (e.g. OOUTH and hospital road)"
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
            <span className="flex-1 text-sm font-semibold">{zone.name}</span>
            <button
              type="button"
              role="switch"
              aria-checked={zone.is_active}
              onClick={() => toggleActive(zone)}
              className={`relative w-11 h-6 rounded-full border-0 cursor-pointer transition-colors ${zone.is_active ? 'bg-brand' : 'bg-[#C3C8CD]'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${zone.is_active ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        ))}
      </div>

      {/* Zone fares matrix */}
      {activeZones.length >= 2 && (
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-4">
          <h3 className="font-bold text-sm">Delivery fares (from vendor zone → customer zone)</h3>
          <p className="text-xs text-ink-2">Each row is a vendor&apos;s zone; each column is the customer&apos;s zone. Set delivery fee and rider pay per pair.</p>
          {activeZones.map(fromZone => (
            <div key={fromZone.id} className="flex flex-col gap-2">
              <span className="text-xs font-bold text-ink-2 uppercase tracking-wide">From: {fromZone.name}</span>
              {activeZones.filter(z => z.id !== fromZone.id).map(toZone => {
                const edit = getEdit(fromZone.id, toZone.id)
                const existing = getFare(fromZone.id, toZone.id)
                const key = fareKey(fromZone.id, toZone.id)
                const isDirty = !!fareEdit[key]
                return (
                  <div key={toZone.id} className="flex items-end gap-2 py-2 border-b border-line last:border-0">
                    <span className="text-sm font-semibold w-32 shrink-0">To: {toZone.name}</span>
                    <div className="flex gap-2 flex-1">
                      <label className="flex flex-col gap-0.5 flex-1">
                        <span className="text-[11px] text-ink-2">Delivery (₦)</span>
                        <input
                          type="number"
                          step="50"
                          value={edit.delivery_fee}
                          onChange={e => setEdit(fromZone.id, toZone.id, 'delivery_fee', e.target.value)}
                          placeholder="0"
                          className="h-9 px-2 rounded-lg border border-line text-sm font-body"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5 flex-1">
                        <span className="text-[11px] text-ink-2">Rider pay (₦)</span>
                        <input
                          type="number"
                          step="50"
                          value={edit.rider_pay}
                          onChange={e => setEdit(fromZone.id, toZone.id, 'rider_pay', e.target.value)}
                          placeholder="0"
                          className="h-9 px-2 rounded-lg border border-line text-sm font-body"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => saveFare(fromZone.id, toZone.id)}
                      disabled={!isDirty && !(!existing && edit.delivery_fee)}
                      className="h-9 px-3 rounded-lg bg-brand text-white text-sm font-bold border-0 disabled:opacity-40"
                    >
                      {existing ? 'Update' : 'Set'}
                    </button>
                    {existing && !isDirty && (
                      <span className="text-xs text-ink-2 whitespace-nowrap">
                        {formatMoney(existing.delivery_fee)} / {formatMoney(existing.rider_pay)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
