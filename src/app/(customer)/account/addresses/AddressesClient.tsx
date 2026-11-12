'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, MapPin, Navigation, X, Check, Trash2, Edit3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import type { Address } from '@/types/database'

interface AreaOption {
  id: string
  name: string
  district: string | null
  zone_id: string | null
}

interface SpotOption {
  id: string
  label: string
  custom_label: string | null
  description: string | null
  area_id: string | null
  is_default: boolean
  created_at: string
}

interface Props {
  userId: string
  addresses: Address[]
  areas: AreaOption[]
  spots: SpotOption[]
}

const LABELS = ['Home', 'Work', 'Other'] as const
type LabelOption = (typeof LABELS)[number]

export function AddressesClient({ userId, addresses: initial, areas, spots: initialSpots }: Props) {
  const router = useRouter()
  const [addresses, setAddresses] = useState(initial)
  const [spots, setSpots] = useState(initialSpots)
  const [sheet, setSheet] = useState<null | 'add' | 'edit'>(null)
  const [editing, setEditing] = useState<Address | null>(null)
  const [label, setLabel] = useState<LabelOption>('Home')
  const [areaId, setAreaId] = useState('')
  const [landmark, setLandmark] = useState('')
  const [details, setDetails] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const supabase = createClient()

  function openAdd() {
    setEditing(null)
    setLabel('Home')
    setAreaId('')
    setLandmark('')
    setDetails('')
    setError('')
    setSheet('add')
  }

  function openEdit(address: Address) {
    setEditing(address)
    const matched = LABELS.find(x => x === address.label)
    setLabel(matched ?? 'Home')
    setAreaId(address.area_id ?? '')
    setLandmark(address.landmark)
    setDetails(address.details ?? '')
    setError('')
    setSheet('edit')
  }

  function closeSheet() {
    setSheet(null)
    setEditing(null)
  }

  async function save() {
    setError('')
    if (!areaId) { setError('Select an area'); return }
    if (!landmark.trim()) { setError('Enter a landmark'); return }

    const area = areas.find(a => a.id === areaId)
    setSaving(true)

    if (sheet === 'add') {
      const { data, error: e } = await supabase
        .from('addresses')
        .insert({
          user_id: userId,
          area_id: areaId,
          zone_id: area?.zone_id ?? null,
          label,
          landmark: landmark.trim(),
          details: details.trim() || null,
          is_default: addresses.length === 0,
        })
        .select()
        .single()
      setSaving(false)
      if (e) { setError(e.message); return }
      setAddresses(prev => [...prev, data as Address])
      setToast('Address saved')
    } else if (sheet === 'edit' && editing) {
      const { error: e } = await supabase
        .from('addresses')
        .update({
          area_id: areaId,
          zone_id: area?.zone_id ?? null,
          label,
          landmark: landmark.trim(),
          details: details.trim() || null,
        })
        .eq('id', editing.id)
      setSaving(false)
      if (e) { setError(e.message); return }
      setAddresses(prev =>
        prev.map(a =>
          a.id === editing.id
            ? { ...a, area_id: areaId, zone_id: area?.zone_id ?? null, label, landmark: landmark.trim(), details: details.trim() || null }
            : a
        )
      )
      setToast('Address updated')
    }

    closeSheet()
  }

  async function remove(addressId: string) {
    const { error: e } = await supabase.from('addresses').delete().eq('id', addressId)
    if (!e) {
      setAddresses(prev => prev.filter(a => a.id !== addressId))
      setToast('Address removed')
    }
  }

  async function removeSpot(spotId: string) {
    const { error: e } = await supabase.from('delivery_spots').delete().eq('id', spotId)
    if (!e) {
      setSpots(prev => prev.filter(s => s.id !== spotId))
      setToast('Spot removed')
    }
  }

  async function setDefault(addressId: string) {
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId)
    await supabase.from('addresses').update({ is_default: true }).eq('id', addressId)
    setAddresses(prev => prev.map(a => ({ ...a, is_default: a.id === addressId })))
  }

  function areaLabel(id: string | null) {
    if (!id) return ''
    const a = areas.find(x => x.id === id)
    if (!a) return ''
    return a.district ? `${a.district} — ${a.name}` : a.name
  }

  return (
    <div className="min-h-dvh bg-canvas font-body text-ink"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>

      <header className="bg-white px-4 pt-5 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-surface flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-heading font-extrabold text-[20px] text-ink flex-1">Saved addresses</h1>
        <button type="button" onClick={openAdd}
          className="w-9 h-9 rounded-full bg-brand flex items-center justify-center">
          <Plus size={18} className="text-white" />
        </button>
      </header>

      <div className="px-4 pt-4 flex flex-col gap-3">
        {addresses.length === 0 && spots.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-14 h-14 rounded-full bg-brand-tint flex items-center justify-center">
              <MapPin size={24} className="text-brand" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-[16px] text-ink">No saved addresses</p>
              <p className="text-[13px] text-ink-2 mt-1">Add your home or work address for faster checkout.</p>
            </div>
            <button type="button" onClick={openAdd}
              className="h-11 px-5 rounded-2xl bg-brand text-white font-bold text-[14px]">
              Add address
            </button>
          </div>
        )}

        {addresses.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden">
            {addresses.map((addr, i) => (
              <div key={addr.id} className={`px-4 py-4 ${i < addresses.length - 1 ? 'border-b border-line' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-brand-tint flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin size={15} className="text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      {addr.label && (
                        <span className="text-[11px] font-bold text-brand-ink bg-brand-tint px-1.5 py-0.5 rounded-md">
                          {addr.label}
                        </span>
                      )}
                      {addr.is_default && (
                        <span className="text-[11px] font-bold text-brand bg-brand-tint px-1.5 py-0.5 rounded-md">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] font-semibold text-ink">{addr.landmark}</p>
                    {addr.area_id && (
                      <p className="text-[12px] text-ink-2 mt-0.5">{areaLabel(addr.area_id)}</p>
                    )}
                    {addr.details && <p className="text-[12px] text-ink-2">{addr.details}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 pl-11">
                  {!addr.is_default && (
                    <button type="button" onClick={() => setDefault(addr.id)}
                      className="flex items-center gap-1 text-[12px] text-brand font-semibold h-8 px-2.5 rounded-lg bg-brand-tint">
                      <Check size={12} /> Set default
                    </button>
                  )}
                  <button type="button" onClick={() => openEdit(addr)}
                    className="flex items-center gap-1 text-[12px] text-ink-2 font-semibold h-8 px-2.5 rounded-lg bg-surface">
                    <Edit3 size={12} /> Edit
                  </button>
                  <button type="button" onClick={() => remove(addr.id)}
                    className="flex items-center gap-1 text-[12px] text-danger font-semibold h-8 px-2.5 rounded-lg bg-red-50">
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {addresses.length > 0 && (
          <button type="button" onClick={openAdd}
            className="bg-white rounded-2xl h-[52px] w-full font-bold text-[15px] text-brand flex items-center justify-center gap-2">
            <Plus size={18} /> Add address
          </button>
        )}

        {/* GPS-pinned delivery spots saved via map */}
        {spots.length > 0 && (
          <>
            <p className="text-[12px] font-semibold text-ink-2 px-1 pt-1">Pinned on map</p>
            <div className="bg-white rounded-2xl overflow-hidden">
              {spots.map((spot, i) => (
                <div key={spot.id} className={`px-4 py-4 ${i < spots.length - 1 ? 'border-b border-line' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-surface flex items-center justify-center shrink-0 mt-0.5">
                      <Navigation size={15} className="text-ink-2" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        {spot.label && (
                          <span className="text-[11px] font-bold text-brand-ink bg-brand-tint px-1.5 py-0.5 rounded-md">
                            {spot.custom_label ?? spot.label}
                          </span>
                        )}
                        <span className="text-[11px] font-semibold text-ink-2 bg-surface px-1.5 py-0.5 rounded-md">GPS pin</span>
                      </div>
                      {spot.description && (
                        <p className="text-[14px] font-semibold text-ink">{spot.description}</p>
                      )}
                      {spot.area_id && (
                        <p className="text-[12px] text-ink-2 mt-0.5">{areaLabel(spot.area_id)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pl-11">
                    <button type="button" onClick={() => removeSpot(spot.id)}
                      className="flex items-center gap-1 text-[12px] text-danger font-semibold h-8 px-2.5 rounded-lg bg-red-50">
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add / Edit sheet */}
      {sheet && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60]" onClick={closeSheet} />
          <div
            className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-3xl max-w-md mx-auto flex flex-col"
            style={{ maxHeight: '92dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
              <span className="font-heading font-bold text-[17px]">
                {sheet === 'add' ? 'Add address' : 'Edit address'}
              </span>
              <button type="button" onClick={closeSheet}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-surface">
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 pb-6 flex flex-col gap-4">
              {/* Label chips */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-ink-2">Label</label>
                <div className="flex gap-2">
                  {LABELS.map(l => (
                    <button key={l} type="button" onClick={() => setLabel(l)}
                      className={`h-9 px-4 rounded-full text-[13px] font-semibold transition-colors ${
                        label === l ? 'bg-brand text-white' : 'bg-surface text-ink-2'
                      }`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Area */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-ink-2">Area in Sagamu</label>
                <select
                  value={areaId}
                  onChange={e => setAreaId(e.target.value)}
                  className="h-11 px-3 rounded-xl border border-line font-body text-[14px] text-ink bg-white"
                >
                  <option value="">Select area…</option>
                  {areas.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.district ? `${a.district} — ${a.name}` : a.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Landmark */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-ink-2">
                  Landmark <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={landmark}
                  onChange={e => setLandmark(e.target.value)}
                  placeholder="e.g. Beside NNPC filling station"
                  className="h-11 px-3 rounded-xl border border-line font-body text-[14px] text-ink bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>

              {/* Details */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-ink-2">Directions (optional)</label>
                <input
                  type="text"
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  placeholder="e.g. Blue gate, 3rd house on the right"
                  className="h-11 px-3 rounded-xl border border-line font-body text-[14px] text-ink bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>

              {error && <p className="text-[13px] text-danger">{error}</p>}

              <Button onClick={save} loading={saving} fullWidth size="lg">
                {sheet === 'add' ? 'Save address' : 'Update address'}
              </Button>
            </div>
          </div>
        </>
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
    </div>
  )
}
