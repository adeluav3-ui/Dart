'use client'

import { useState, useEffect } from 'react'
import { MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Area, Zone, AreaRequest } from '@/types/database'

type EditState = {
  name: string
  zone_id: string
  aliases: string
  lat: string
  lng: string
  status: 'active' | 'coming_soon'
}

const EMPTY_EDIT: EditState = { name: '', zone_id: '', aliases: '', lat: '', lng: '', status: 'active' }

export default function AdminAreasPage() {
  const [areas, setAreas] = useState<Area[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [requests, setRequests] = useState<AreaRequest[]>([])
  const [edit, setEdit] = useState<EditState>(EMPTY_EDIT)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('areas').select('*').order('sort_order').then(({ data }) => setAreas((data ?? []) as Area[]))
    supabase.from('zones').select('*').eq('is_active', true).order('name').then(({ data }) => setZones((data ?? []) as Zone[]))
    supabase.from('area_requests').select('*').order('created_at', { ascending: false }).then(({ data }) => setRequests((data ?? []) as AreaRequest[]))
  }, [])

  function startAdd() {
    setEditingId('__new__')
    setEdit(EMPTY_EDIT)
  }

  function startEdit(area: Area) {
    setEditingId(area.id)
    setEdit({
      name: area.name,
      zone_id: area.zone_id ?? '',
      aliases: area.aliases.join(', '),
      lat: area.lat != null ? String(area.lat) : '',
      lng: area.lng != null ? String(area.lng) : '',
      status: area.status,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEdit(EMPTY_EDIT)
  }

  function detectLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setEdit(e => ({
          ...e,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        }))
        setLocating(false)
      },
      () => setLocating(false),
      { timeout: 8000 }
    )
  }

  function parseAliases(raw: string): string[] {
    return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  }

  async function save() {
    if (!edit.name.trim()) return
    setSaving(true)

    const payload = {
      name: edit.name.trim(),
      zone_id: edit.zone_id || null,
      aliases: parseAliases(edit.aliases),
      lat: edit.lat ? parseFloat(edit.lat) : null,
      lng: edit.lng ? parseFloat(edit.lng) : null,
      status: edit.status,
    }

    if (editingId === '__new__') {
      const { data } = await supabase.from('areas').insert(payload).select().single()
      if (data) setAreas(p => [...p, data as Area])
    } else {
      await supabase.from('areas').update(payload).eq('id', editingId!)
      setAreas(p => p.map(a => a.id === editingId ? { ...a, ...payload } : a))
    }

    setSaving(false)
    cancelEdit()
  }

  const zoneMap = Object.fromEntries(zones.map(z => [z.id, z]))
  const areasByZone: { zone: Zone | null; areas: Area[] }[] = []
  const seen = new Set<string | null>()
  for (const a of areas) {
    if (!seen.has(a.zone_id)) {
      seen.add(a.zone_id)
      areasByZone.push({
        zone: a.zone_id ? (zoneMap[a.zone_id] ?? null) : null,
        areas: areas.filter(x => x.zone_id === a.zone_id),
      })
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-xl">Delivery Areas</h2>
        <Button onClick={startAdd} size="md">+ Add area</Button>
      </div>

      {/* Add / Edit form */}
      {editingId && (
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
          <h3 className="font-bold text-sm">{editingId === '__new__' ? 'New area' : 'Edit area'}</h3>
          <Input label="Name" placeholder="e.g. OOUTH and hospital road" value={edit.name} onChange={e => setEdit(p => ({ ...p, name: e.target.value }))} />
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
            Zone
            <select
              value={edit.zone_id}
              onChange={e => setEdit(p => ({ ...p, zone_id: e.target.value }))}
              className="h-btn-sm px-3 rounded-xl border border-line bg-white font-body text-[15px] text-ink font-normal"
            >
              <option value="">— None (coming soon) —</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </label>
          <Input
            label="Aliases (comma-separated, lowercase)"
            placeholder="oouth, hospital road"
            value={edit.aliases}
            onChange={e => setEdit(p => ({ ...p, aliases: e.target.value }))}
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <Input label="Latitude" placeholder="e.g. 6.9667" value={edit.lat} onChange={e => setEdit(p => ({ ...p, lat: e.target.value }))} />
            </div>
            <div className="flex-1">
              <Input label="Longitude" placeholder="e.g. 3.6444" value={edit.lng} onChange={e => setEdit(p => ({ ...p, lng: e.target.value }))} />
            </div>
            <div className="flex items-end pb-0.5">
              <button
                type="button"
                onClick={detectLocation}
                disabled={locating}
                title="Use current location"
                className="h-btn-sm px-3 rounded-xl border border-line bg-white flex items-center gap-1.5 text-sm font-semibold text-brand disabled:opacity-50"
              >
                {locating ? (
                  <span className="w-4 h-4 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
                ) : (
                  <MapPin size={15} />
                )}
                Locate
              </button>
            </div>
          </div>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
            Status
            <select
              value={edit.status}
              onChange={e => setEdit(p => ({ ...p, status: e.target.value as 'active' | 'coming_soon' }))}
              className="h-btn-sm px-3 rounded-xl border border-line bg-white font-body text-[15px] text-ink font-normal"
            >
              <option value="active">Active</option>
              <option value="coming_soon">Coming soon</option>
            </select>
          </label>
          <div className="flex gap-2 pt-1">
            <Button onClick={save} loading={saving} size="md">Save</Button>
            <Button onClick={cancelEdit} variant="ghost" size="md">Cancel</Button>
          </div>
        </div>
      )}

      {/* Area list */}
      <div className="flex flex-col gap-4">
        {areasByZone.map(({ zone, areas: zoneAreas }) => (
          <div key={zone?.id ?? '__none'} className="bg-white rounded-2xl p-4 flex flex-col gap-2">
            <h3 className="text-[11px] font-bold text-ink-2 uppercase tracking-wide">
              {zone?.name ?? 'No zone (coming soon)'}
            </h3>
            {zoneAreas.map(area => (
              <div key={area.id} className="flex items-start gap-3 py-2 border-b border-line last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold">{area.name}</span>
                    {area.status === 'coming_soon' && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface text-ink-2 font-semibold">
                        Coming soon
                      </span>
                    )}
                  </div>
                  {area.aliases.length > 0 && (
                    <p className="text-xs text-ink-2 mt-0.5">{area.aliases.join(', ')}</p>
                  )}
                  {(area.lat != null && area.lng != null) && (
                    <p className="text-xs text-ink-2 mt-0.5">{area.lat.toFixed(4)}, {area.lng.toFixed(4)}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(area)}
                  className="shrink-0 text-xs font-semibold text-brand"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Waitlist requests */}
      {requests.length > 0 && (
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-2">
          <h3 className="font-bold text-sm">Area requests ({requests.length})</h3>
          {requests.map(r => (
            <div key={r.id} className="flex items-center gap-3 py-1.5 border-b border-line last:border-0">
              <div className="flex-1">
                <span className="text-[14px] font-medium">{r.area_name}</span>
                {r.email && <span className="ml-2 text-xs text-ink-2">{r.email}</span>}
              </div>
              <span className="text-xs text-ink-2">{new Date(r.created_at).toLocaleDateString('en-NG')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
