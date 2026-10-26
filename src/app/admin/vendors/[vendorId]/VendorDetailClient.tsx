'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Vendor, MenuCategory, MenuItem, OptionGroup, Option } from '@/types/database'

interface Props {
  vendor: Vendor
  categories: MenuCategory[]
  items: MenuItem[]
  optionGroups: OptionGroup[]
  options: Option[]
}

interface RiderRow {
  id: string
  full_name: string | null
  is_matched: boolean
}

type ActiveView = 'info' | 'menu' | 'options' | 'riders'

export function VendorDetailClient({ vendor: initialVendor, categories: initialCats, items: initialItems, optionGroups: initialGroups, options: initialOptions }: Props) {
  const [view, setView] = useState<ActiveView>('info')
  const [vendor, setVendor] = useState(initialVendor)
  const [categories, setCategories] = useState(initialCats)
  const [items, setItems] = useState(initialItems)
  const [optionGroups, setOptionGroups] = useState(initialGroups)
  const [options, setOptions] = useState(initialOptions)
  const [saving, setSaving] = useState(false)
  const [allRiders, setAllRiders] = useState<RiderRow[]>([])
  const supabase = createClient()

  useEffect(() => {
    async function loadRiders() {
      const [{ data: allR }, { data: matched }] = await Promise.all([
        supabase.from('riders').select('id, profiles(full_name)').eq('is_active', true),
        supabase.from('vendor_riders').select('rider_id').eq('vendor_id', vendor.id),
      ])
      const matchedIds = new Set((matched ?? []).map((r: { rider_id: string }) => r.rider_id))
      type RiderData = { id: string; profiles: { full_name: string | null }[] | null }
      setAllRiders((allR as unknown as RiderData[] ?? []).map(r => {
        const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
        return { id: r.id, full_name: p?.full_name ?? null, is_matched: matchedIds.has(r.id) }
      }))
    }
    loadRiders()
  }, [vendor.id])

  async function toggleRiderMatch(riderId: string, isCurrentlyMatched: boolean) {
    if (isCurrentlyMatched) {
      await supabase.from('vendor_riders').delete().eq('vendor_id', vendor.id).eq('rider_id', riderId)
    } else {
      await supabase.from('vendor_riders').insert({ vendor_id: vendor.id, rider_id: riderId })
    }
    setAllRiders(prev => prev.map(r => r.id === riderId ? { ...r, is_matched: !isCurrentlyMatched } : r))
  }

  // New item form
  const [newItem, setNewItem] = useState({ name: '', description: '', base_price: '', category_id: categories[0]?.id ?? '', pack_size: '' })
  const [newCatName, setNewCatName] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  async function saveVendorInfo() {
    setSaving(true)
    await supabase.from('vendors').update({
      is_verified: vendor.is_verified,
      commission_rate: vendor.commission_rate,
      avg_prep_mins: vendor.avg_prep_mins,
      payout_bank: vendor.payout_bank,
      payout_account_no: vendor.payout_account_no,
      payout_account_name: vendor.payout_account_name,
    }).eq('id', vendor.id)
    setSaving(false)
  }

  async function addCategory() {
    if (!newCatName.trim()) return
    const { data } = await supabase
      .from('menu_categories')
      .insert({ vendor_id: vendor.id, name: newCatName.trim(), sort_order: categories.length })
      .select()
      .single()
    if (data) { setCategories(p => [...p, data as MenuCategory]); setNewCatName('') }
  }

  async function addItem() {
    if (!newItem.name.trim() || !newItem.base_price) return
    setSaving(true)

    let photoUrl = null
    if (photoFile) {
      const path = `${vendor.id}/${Date.now()}-${photoFile.name}`
      const { error } = await supabase.storage.from('item-photos').upload(path, photoFile, { contentType: photoFile.type })
      if (!error) {
        photoUrl = supabase.storage.from('item-photos').getPublicUrl(path).data.publicUrl
      }
    }

    const { data } = await supabase.from('menu_items').insert({
      vendor_id: vendor.id,
      category_id: newItem.category_id || null,
      name: newItem.name.trim(),
      description: newItem.description.trim() || null,
      base_price: Math.round(parseFloat(newItem.base_price) * 100),
      pack_size: newItem.pack_size.trim() || null,
      photo_url: photoUrl,
      sort_order: items.filter(i => i.category_id === newItem.category_id).length,
    }).select().single()

    if (data) {
      setItems(p => [...p, data as MenuItem])
      setNewItem({ name: '', description: '', base_price: '', category_id: categories[0]?.id ?? '', pack_size: '' })
      setPhotoFile(null)
    }
    setSaving(false)
  }

  async function addOptionGroup(itemId: string, name: string, minSelect: number, maxSelect: number) {
    const { data } = await supabase.from('option_groups').insert({
      item_id: itemId, name, min_select: minSelect, max_select: maxSelect,
      sort_order: optionGroups.filter(g => g.item_id === itemId).length,
    }).select().single()
    if (data) setOptionGroups(p => [...p, data as OptionGroup])
  }

  async function addOption(groupId: string, name: string, priceDelta: number) {
    const { data } = await supabase.from('options').insert({
      group_id: groupId, name, price_delta: Math.round(priceDelta * 100), sort_order: options.filter(o => o.group_id === groupId).length,
    }).select().single()
    if (data) setOptions(p => [...p, data as Option])
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-xl">{vendor.name}</h2>
        <div className="flex gap-1">
          {(['info', 'menu', 'options', 'riders'] as ActiveView[]).map(v => (
            <button key={v} type="button" onClick={() => setView(v)}
              className={`h-9 px-3 rounded-xl text-sm font-semibold capitalize ${view === v ? 'bg-ink text-white' : 'bg-surface text-ink'}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === 'info' && (
        <div className="bg-white rounded-2xl p-5 flex flex-col gap-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={vendor.is_verified}
              onChange={e => setVendor(v => ({ ...v, is_verified: e.target.checked }))} />
            <span className="text-sm font-semibold">Verified kitchen</span>
          </label>
          <Input label="Commission %" type="number" step="0.5"
            value={(vendor.commission_rate * 100).toFixed(1)}
            onChange={e => setVendor(v => ({ ...v, commission_rate: parseFloat(e.target.value) / 100 }))} />
          <Input label="Avg prep time (mins)" type="number"
            value={vendor.avg_prep_mins}
            onChange={e => setVendor(v => ({ ...v, avg_prep_mins: parseInt(e.target.value) }))} />
          <Input label="Payout bank" value={vendor.payout_bank ?? ''}
            onChange={e => setVendor(v => ({ ...v, payout_bank: e.target.value }))} />
          <Input label="Account number" value={vendor.payout_account_no ?? ''}
            onChange={e => setVendor(v => ({ ...v, payout_account_no: e.target.value }))} />
          <Input label="Account name" value={vendor.payout_account_name ?? ''}
            onChange={e => setVendor(v => ({ ...v, payout_account_name: e.target.value }))} />
          <Button onClick={saveVendorInfo} loading={saving} size="lg">Save changes</Button>
        </div>
      )}

      {view === 'menu' && (
        <div className="flex flex-col gap-3">
          {/* Add category */}
          <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
            <h3 className="font-bold text-sm">Categories</h3>
            <div className="flex gap-2">
              <input type="text" placeholder="Category name" value={newCatName}
                onChange={e => setNewCatName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCategory()}
                className="flex-1 h-9 px-3 rounded-xl border border-line text-sm font-body" />
              <button type="button" onClick={addCategory} className="h-9 px-3 rounded-xl bg-brand text-white text-sm font-bold">Add</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map(c => (
                <span key={c.id} className="px-3 py-1 rounded-full bg-surface text-xs font-semibold">{c.name}</span>
              ))}
            </div>
          </div>

          {/* Add item */}
          <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
            <h3 className="font-bold text-sm">Add menu item</h3>
            <Input label="Item name" value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} />
            <Input label="Description (optional)" value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))} />
            <Input label="Base price (₦)" type="number" step="50" value={newItem.base_price} onChange={e => setNewItem(p => ({ ...p, base_price: e.target.value }))} />
            <Input label="Pack size (e.g. 1 L)" value={newItem.pack_size} onChange={e => setNewItem(p => ({ ...p, pack_size: e.target.value }))} />
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
              Category
              <select value={newItem.category_id} onChange={e => setNewItem(p => ({ ...p, category_id: e.target.value }))}
                className="h-btn-sm px-3 rounded-xl border border-line font-body text-[15px]">
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
              Photo
              <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] ?? null)} className="text-sm" />
            </label>
            <Button onClick={addItem} loading={saving} size="lg">Add item</Button>
          </div>

          {/* Item list */}
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-2xl p-4 flex items-center gap-3">
              <div className="flex-1">
                <p className="font-bold text-sm">{item.name}</p>
                <p className="text-xs text-ink-2">{formatMoney(item.base_price)}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.is_available ? 'bg-brand-tint text-brand-ink' : 'bg-surface text-ink-2'}`}>
                {item.is_available ? 'Available' : 'Sold out'}
              </span>
            </div>
          ))}
        </div>
      )}

      {view === 'options' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-2">Select an item to manage its option groups</p>
          {items.filter(i => i.is_available).map(item => {
            const itemGroups = optionGroups.filter(g => g.item_id === item.id)
            return (
              <ItemOptionsSection
                key={item.id}
                item={item}
                groups={itemGroups}
                options={options}
                onAddGroup={(name, min, max) => addOptionGroup(item.id, name, min, max)}
                onAddOption={(groupId, name, price) => addOption(groupId, name, price)}
              />
            )
          })}
        </div>
      )}

      {view === 'riders' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-2">Toggle which riders are matched to this vendor. Matched riders appear first in the dispatch list.</p>
          {allRiders.length === 0 && (
            <p className="text-ink-2 text-sm py-4 text-center">No active riders yet — add them in the Riders section.</p>
          )}
          {allRiders.map(r => (
            <div key={r.id} className="bg-white rounded-2xl p-4 flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-surface flex items-center justify-center font-bold text-sm">
                {r.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '??'}
              </span>
              <span className="flex-1 text-sm font-semibold">{r.full_name ?? 'Unnamed rider'}</span>
              {r.is_matched && (
                <span className="text-xs font-bold text-brand bg-brand-tint px-2 py-0.5 rounded-full">Matched</span>
              )}
              <button
                type="button"
                role="switch"
                aria-checked={r.is_matched}
                onClick={() => toggleRiderMatch(r.id, r.is_matched)}
                className={`relative w-11 h-6 rounded-full border-0 cursor-pointer transition-colors ${r.is_matched ? 'bg-brand' : 'bg-[#C3C8CD]'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${r.is_matched ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ItemOptionsSection({
  item, groups, options, onAddGroup, onAddOption
}: {
  item: MenuItem
  groups: OptionGroup[]
  options: Option[]
  onAddGroup: (name: string, min: number, max: number) => void
  onAddOption: (groupId: string, name: string, price: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [newGroup, setNewGroup] = useState({ name: '', min: '0', max: '1' })
  const [newOption, setNewOption] = useState<Record<string, { name: string; price: string }>>({})

  return (
    <div className="bg-white rounded-2xl p-4 flex flex-col gap-2">
      <button type="button" onClick={() => setExpanded(p => !p)}
        className="flex justify-between items-center w-full text-left">
        <span className="font-bold text-sm">{item.name}</span>
        <span className="text-xs text-ink-2">{groups.length} group{groups.length !== 1 ? 's' : ''} · {expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 mt-2">
          {groups.map(group => (
            <div key={group.id} className="border border-line rounded-xl p-3 flex flex-col gap-2">
              <span className="text-sm font-bold">{group.name} (min {group.min_select}, max {group.max_select})</span>
              {options.filter(o => o.group_id === group.id).map(opt => (
                <div key={opt.id} className="flex justify-between text-sm pl-2">
                  <span>{opt.name}</span>
                  <span className="text-ink-2">{opt.price_delta > 0 ? '+' : ''}{formatMoney(opt.price_delta)}</span>
                </div>
              ))}
              <div className="flex gap-2 mt-1">
                <input type="text" placeholder="Option name" value={newOption[group.id]?.name ?? ''}
                  onChange={e => setNewOption(p => ({ ...p, [group.id]: { ...p[group.id], name: e.target.value } }))}
                  className="flex-1 h-9 px-2 rounded-lg border border-line text-sm font-body" />
                <input type="number" placeholder="₦ delta" value={newOption[group.id]?.price ?? ''}
                  onChange={e => setNewOption(p => ({ ...p, [group.id]: { ...p[group.id], price: e.target.value } }))}
                  className="w-20 h-9 px-2 rounded-lg border border-line text-sm font-body" />
                <button type="button"
                  onClick={() => {
                    const n = newOption[group.id]
                    if (n?.name) onAddOption(group.id, n.name, parseFloat(n.price ?? '0'))
                  }}
                  className="h-9 px-3 rounded-lg bg-brand-tint text-brand-ink text-xs font-bold">+</button>
              </div>
            </div>
          ))}

          <div className="flex flex-col gap-2 border border-dashed border-line rounded-xl p-3">
            <span className="text-xs font-semibold text-ink-2">Add option group</span>
            <div className="flex gap-2">
              <input type="text" placeholder="Group name" value={newGroup.name}
                onChange={e => setNewGroup(p => ({ ...p, name: e.target.value }))}
                className="flex-1 h-9 px-2 rounded-lg border border-line text-sm font-body" />
              <input type="number" placeholder="Min" value={newGroup.min} min="0"
                onChange={e => setNewGroup(p => ({ ...p, min: e.target.value }))}
                className="w-14 h-9 px-2 rounded-lg border border-line text-sm font-body" />
              <input type="number" placeholder="Max" value={newGroup.max} min="1"
                onChange={e => setNewGroup(p => ({ ...p, max: e.target.value }))}
                className="w-14 h-9 px-2 rounded-lg border border-line text-sm font-body" />
              <button type="button"
                onClick={() => { if (newGroup.name) { onAddGroup(newGroup.name, parseInt(newGroup.min), parseInt(newGroup.max)); setNewGroup({ name: '', min: '0', max: '1' }) }}}
                className="h-9 px-3 rounded-lg bg-brand text-white text-xs font-bold">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
