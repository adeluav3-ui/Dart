'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/format'
import type { Vendor, MenuCategory, MenuItem, VendorType } from '@/types/database'

interface OptionItem {
  name: string
  price_delta: number
}

interface OptionGroupDraft {
  id: string
  name: string
  min_select: number
  max_select: number
  options: OptionItem[]
}

interface Props {
  vendor: Vendor
  categories: MenuCategory[]
  item?: MenuItem
  initialOptionGroups?: OptionGroupDraft[]
}

function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1600
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
        else { width = Math.round((width * MAX) / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Compression failed')),
        'image/webp',
        0.82,
      )
    }
    img.onerror = reject
    img.src = url
  })
}

const isRestaurant = (type: VendorType) => type === 'restaurant'
const isSupOrPharm = (type: VendorType) => type === 'supermarket' || type === 'pharmacy'

export function ItemFormClient({ vendor, categories, item, initialOptionGroups = [] }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [categoryId, setCategoryId] = useState(item?.category_id ?? categories[0]?.id ?? '')
  const [priceStr, setPriceStr] = useState(item?.base_price ? String(item.base_price / 100) : '')
  const [packSize, setPackSize] = useState(item?.pack_size ?? '')
  const [photoUrl, setPhotoUrl] = useState<string | null>(item?.photo_url ?? null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [optionGroups, setOptionGroups] = useState<OptionGroupDraft[]>(initialOptionGroups)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isLive = item?.status === 'live'
  const priceKobo = Math.round(parseFloat(priceStr || '0') * 100)
  const valid = name.trim().length > 0

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const blob = await compressImage(file)
      setPhotoBlob(blob)
      setPhotoPreview(URL.createObjectURL(blob))
    } catch {
      setError('Could not process image. Try a different file.')
    }
  }

  async function uploadPhoto(itemId: string): Promise<string | null> {
    if (!photoBlob) return null
    const path = `${vendor.id}/${itemId}.webp`
    const { error: upErr } = await supabase.storage
      .from('item-photos')
      .upload(path, photoBlob, { contentType: 'image/webp', upsert: true })
    if (upErr) { setError('Photo upload failed.'); return null }
    const { data: { publicUrl } } = supabase.storage.from('item-photos').getPublicUrl(path)
    return publicUrl
  }

  async function saveOptionGroups(itemId: string) {
    // Delete existing groups for this item then recreate
    await supabase.from('option_groups').delete().eq('item_id', itemId)
    for (let gi = 0; gi < optionGroups.length; gi++) {
      const g = optionGroups[gi]
      const { data: grp } = await supabase
        .from('option_groups')
        .insert({ item_id: itemId, name: g.name, min_select: g.min_select, max_select: g.max_select, sort_order: gi })
        .select()
        .single()
      if (!grp) continue
      for (let oi = 0; oi < g.options.length; oi++) {
        const o = g.options[oi]
        await supabase.from('options').insert({
          group_id: grp.id, name: o.name, price_delta: o.price_delta, is_available: true, sort_order: oi,
        })
      }
    }
  }

  async function handleSave() {
    if (!valid) return
    setSaving(true)
    setError(null)

    try {
      if (item) {
        // Edit existing item
        let uploadedUrl: string | null = null
        if (photoBlob) {
          uploadedUrl = await uploadPhoto(item.id)
          if (!uploadedUrl) { setSaving(false); return }
        }

        if (isLive) {
          // For live items: changes to price/photo go to pending fields
          const updates: Record<string, unknown> = { name: name.trim(), description: description.trim() || null, category_id: categoryId || null, pack_size: packSize.trim() || null }
          if (priceKobo > 0 && priceKobo !== item.base_price) updates.pending_price = priceKobo
          if (uploadedUrl) updates.pending_photo_url = uploadedUrl
          await supabase.from('menu_items').update(updates).eq('id', item.id)
        } else {
          const updates: Record<string, unknown> = { name: name.trim(), description: description.trim() || null, category_id: categoryId || null, pack_size: packSize.trim() || null }
          if (priceKobo > 0) updates.base_price = priceKobo
          if (uploadedUrl) updates.photo_url = uploadedUrl
          await supabase.from('menu_items').update(updates).eq('id', item.id)
        }

        if (isRestaurant(vendor.type)) {
          await saveOptionGroups(item.id)
        }
      } else {
        // Create new item
        const { data: newItem, error: insertErr } = await supabase
          .from('menu_items')
          .insert({
            vendor_id: vendor.id,
            category_id: categoryId || null,
            name: name.trim(),
            description: description.trim() || null,
            base_price: priceKobo,
            pack_size: packSize.trim() || null,
            sort_order: 0,
            is_available: true,
            status: 'draft',
          })
          .select()
          .single()

        if (insertErr || !newItem) { setError('Failed to create item.'); setSaving(false); return }

        if (photoBlob) {
          const uploadedUrl = await uploadPhoto(newItem.id)
          if (uploadedUrl) {
            await supabase.from('menu_items').update({ photo_url: uploadedUrl }).eq('id', newItem.id)
          }
        }

        if (isRestaurant(vendor.type)) {
          await saveOptionGroups(newItem.id)
        }
      }

      router.push('/vendor/menu')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function submitForReview() {
    if (!item) return
    setSaving(true)
    await fetch(`/api/vendor/items/${item.id}/submit`, { method: 'POST' })
    setSaving(false)
    router.push('/vendor/menu')
  }

  function addOptionGroup() {
    setOptionGroups(prev => [...prev, {
      id: crypto.randomUUID(),
      name: '',
      min_select: 0,
      max_select: 1,
      options: [{ name: '', price_delta: 0 }],
    }])
  }

  function updateGroup(idx: number, patch: Partial<OptionGroupDraft>) {
    setOptionGroups(prev => prev.map((g, i) => i === idx ? { ...g, ...patch } : g))
  }

  function removeGroup(idx: number) {
    setOptionGroups(prev => prev.filter((_, i) => i !== idx))
  }

  function addOption(groupIdx: number) {
    setOptionGroups(prev => prev.map((g, i) =>
      i === groupIdx ? { ...g, options: [...g.options, { name: '', price_delta: 0 }] } : g
    ))
  }

  function updateOption(groupIdx: number, optIdx: number, patch: Partial<OptionItem>) {
    setOptionGroups(prev => prev.map((g, i) =>
      i === groupIdx ? { ...g, options: g.options.map((o, j) => j === optIdx ? { ...o, ...patch } : o) } : g
    ))
  }

  function removeOption(groupIdx: number, optIdx: number) {
    setOptionGroups(prev => prev.map((g, i) =>
      i === groupIdx ? { ...g, options: g.options.filter((_, j) => j !== optIdx) } : g
    ))
  }

  const photoSrc = photoPreview ?? photoUrl

  return (
    <div className="min-h-screen bg-canvas font-body text-ink flex flex-col">
      <header className="bg-white px-4 pt-5 pb-3 border-b border-line flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full border border-line bg-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h1 className="font-heading font-extrabold text-xl">
          {item ? 'Edit item' : 'New item'}
        </h1>
      </header>

      {isLive && (
        <div className="mx-4 mt-3 px-4 py-3 bg-brand-tint rounded-2xl">
          <p className="text-sm text-brand-ink font-medium">
            This item is live. Price and photo changes will be reviewed before going live. Other edits apply immediately.
          </p>
        </div>
      )}

      <div className="px-4 py-4 flex flex-col gap-5 pb-28">
        {/* Photo */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold">Photo</label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-44 rounded-2xl bg-photo flex flex-col items-center justify-center gap-2 overflow-hidden border-2 border-dashed border-[#C9B99A]"
          >
            {photoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoSrc} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#B8A98C" strokeWidth="1.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span className="text-sm font-medium text-[#B8A98C]">Tap to add photo</span>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={pickPhoto}
          />
          {photoSrc && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-sm font-semibold text-brand text-center"
            >
              Change photo
            </button>
          )}
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold">Item name <span className="text-danger">*</span></label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Jollof Rice"
            className="h-12 px-4 rounded-2xl border border-line bg-white text-sm font-body"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            rows={2}
            className="px-4 py-3 rounded-2xl border border-line bg-white text-sm font-body resize-none"
          />
        </div>

        {/* Category */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold">Category</label>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            className="h-12 px-4 rounded-2xl border border-line bg-white text-sm font-body"
          >
            <option value="">No category</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Price */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold">
            Price (₦){isLive && ' — changes go to review'}
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-ink-2">₦</span>
            <input
              type="number"
              value={priceStr}
              onChange={e => setPriceStr(e.target.value)}
              placeholder="0"
              min="0"
              step="0.01"
              className="w-full h-12 pl-8 pr-4 rounded-2xl border border-line bg-white text-sm font-body"
            />
          </div>
          {priceKobo > 0 && (
            <span className="text-xs text-ink-2">{formatMoney(priceKobo)}</span>
          )}
        </div>

        {/* Pack size (supermarket/pharmacy only) */}
        {isSupOrPharm(vendor.type) && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold">Pack size</label>
            <input
              type="text"
              value={packSize}
              onChange={e => setPackSize(e.target.value)}
              placeholder="e.g. 1kg, 500ml, 10 tabs"
              className="h-12 px-4 rounded-2xl border border-line bg-white text-sm font-body"
            />
          </div>
        )}

        {/* Option groups (restaurant only) */}
        {isRestaurant(vendor.type) && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold">Options</label>
              <button
                type="button"
                onClick={addOptionGroup}
                className="text-sm font-semibold text-brand"
              >
                + Add group
              </button>
            </div>

            {optionGroups.map((group, gi) => (
              <div key={group.id} className="bg-white rounded-2xl p-4 flex flex-col gap-3 border border-line">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={group.name}
                    onChange={e => updateGroup(gi, { name: e.target.value })}
                    placeholder="Group name, e.g. Choose protein"
                    className="flex-1 h-10 px-3 rounded-xl border border-line text-sm font-body"
                  />
                  <button type="button" onClick={() => removeGroup(gi)} className="text-danger text-sm font-bold">
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
                    Min
                    <input
                      type="number"
                      min="0"
                      value={group.min_select}
                      onChange={e => updateGroup(gi, { min_select: +e.target.value })}
                      className="h-9 px-3 rounded-xl border border-line text-sm font-body"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
                    Max
                    <input
                      type="number"
                      min="1"
                      value={group.max_select}
                      onChange={e => updateGroup(gi, { max_select: +e.target.value })}
                      className="h-9 px-3 rounded-xl border border-line text-sm font-body"
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-2">
                  {group.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={opt.name}
                        onChange={e => updateOption(gi, oi, { name: e.target.value })}
                        placeholder="Option name"
                        className="flex-1 h-9 px-3 rounded-xl border border-line text-sm font-body"
                      />
                      <div className="relative w-24">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-ink-2">+₦</span>
                        <input
                          type="number"
                          min="0"
                          value={opt.price_delta / 100}
                          onChange={e => updateOption(gi, oi, { price_delta: Math.round(+e.target.value * 100) })}
                          className="w-full h-9 pl-7 pr-2 rounded-xl border border-line text-sm font-body"
                        />
                      </div>
                      {group.options.length > 1 && (
                        <button type="button" onClick={() => removeOption(gi, oi)} className="text-ink-2">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addOption(gi)}
                    className="text-sm font-semibold text-brand text-left"
                  >
                    + Add option
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-danger bg-red-50 rounded-xl px-4 py-3">{error}</p>
        )}

        {/* Save button */}
        <button
          type="button"
          disabled={!valid || saving}
          onClick={handleSave}
          className="w-full h-btn rounded-2xl bg-brand text-white font-body text-base font-bold border-0 disabled:opacity-50"
        >
          {saving ? 'Saving…' : item ? 'Save changes' : 'Create item'}
        </button>

        {/* Submit for review (only if draft/rejected) */}
        {item && (item.status === 'draft' || item.status === 'rejected') && item.base_price > 0 && item.photo_url && (
          <button
            type="button"
            disabled={saving}
            onClick={submitForReview}
            className="w-full h-btn rounded-2xl bg-white border border-brand text-brand font-body text-base font-bold disabled:opacity-50"
          >
            Submit for review
          </button>
        )}

        {/* Delete (only existing items not live) */}
        {item && item.status !== 'live' && (
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              if (!confirm('Delete this item?')) return
              await supabase.from('menu_items').delete().eq('id', item.id)
              router.push('/vendor/menu')
            }}
            className="w-full h-btn rounded-2xl bg-white border border-line text-danger font-body text-base font-bold disabled:opacity-50"
          >
            Delete item
          </button>
        )}
      </div>
    </div>
  )
}
