'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Zone } from '@/types/database'

export default function AdminZonesPage() {
  const [zones, setZones] = useState<Zone[]>([])
  const [zoneName, setZoneName] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('zones').select('id, name, is_active').order('name').then(({ data }) => setZones((data ?? []) as Zone[]))
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

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <h2 className="font-heading font-bold text-xl">Zones</h2>

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
    </div>
  )
}
