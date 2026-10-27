'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Vendor, MenuTemplate, VendorType } from '@/types/database'

interface Props {
  vendor: Vendor
  templates: MenuTemplate[]
  existingCategoryNames: string[]
}

type PackItem = { templateId: string; itemName: string; categoryName: string; description: string | null; defaultOptionGroups: unknown }

// Group templates by pack_name
function groupByPack(templates: MenuTemplate[]): Record<string, PackItem[]> {
  const result: Record<string, PackItem[]> = {}
  for (const t of templates) {
    if (!result[t.pack_name]) result[t.pack_name] = []
    result[t.pack_name].push({
      templateId: t.id,
      itemName: t.item_name,
      categoryName: t.category_name,
      description: t.description,
      defaultOptionGroups: t.default_option_groups,
    })
  }
  return result
}

const STORE_TYPES: { value: VendorType; label: string }[] = [
  { value: 'restaurant', label: 'Kitchen' },
  { value: 'supermarket', label: 'Supermarket' },
  { value: 'pharmacy', label: 'Pharmacy' },
]

export function TemplatePickerClient({ vendor, templates, existingCategoryNames }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [storeType, setStoreType] = useState<VendorType>(vendor.type)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [done, setDone] = useState(false)

  const filtered = templates.filter(t => t.store_type === storeType)
  const packs = groupByPack(filtered)

  function toggleItem(templateId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(templateId) ? next.delete(templateId) : next.add(templateId)
      return next
    })
  }

  function selectPack(packItems: PackItem[]) {
    setSelected(prev => {
      const next = new Set(prev)
      const allSelected = packItems.every(i => next.has(i.templateId))
      for (const i of packItems) {
        allSelected ? next.delete(i.templateId) : next.add(i.templateId)
      }
      return next
    })
  }

  async function createItems() {
    if (selected.size === 0) return
    setCreating(true)

    const selectedTemplates = filtered.filter(t => selected.has(t.id))

    // Ensure categories exist, collect category_id map
    const catMap: Record<string, string> = {}
    for (const catName of existingCategoryNames) {
      catMap[catName.toLowerCase()] = catName
    }

    // Get or create categories
    for (const t of selectedTemplates) {
      const key = t.category_name.toLowerCase()
      if (!catMap[key]) {
        const { data: cat } = await supabase
          .from('menu_categories')
          .insert({ vendor_id: vendor.id, name: t.category_name, sort_order: 100 })
          .select()
          .single()
        if (cat) catMap[key] = cat.id
      }
    }

    // Fetch existing categories to build id map
    const { data: cats } = await supabase
      .from('menu_categories')
      .select('id, name')
      .eq('vendor_id', vendor.id)

    const catIdMap: Record<string, string> = {}
    for (const c of cats ?? []) {
      catIdMap[c.name.toLowerCase()] = c.id
    }

    // Create items
    for (let i = 0; i < selectedTemplates.length; i++) {
      const t = selectedTemplates[i]
      const catId = catIdMap[t.category_name.toLowerCase()] ?? null

      const { data: newItem } = await supabase
        .from('menu_items')
        .insert({
          vendor_id: vendor.id,
          category_id: catId,
          name: t.item_name,
          description: t.description,
          base_price: 0,
          sort_order: t.sort_order,
          is_available: true,
          status: 'draft',
        })
        .select()
        .single()

      // Create default option groups if any
      if (newItem && t.default_option_groups) {
        const groups = t.default_option_groups as Array<{
          name: string; min_select: number; max_select: number
          options: Array<{ name: string; price_delta: number }>
        }>
        for (let gi = 0; gi < groups.length; gi++) {
          const g = groups[gi]
          const { data: grp } = await supabase
            .from('option_groups')
            .insert({ item_id: newItem.id, name: g.name, min_select: g.min_select, max_select: g.max_select, sort_order: gi })
            .select()
            .single()
          if (grp) {
            for (let oi = 0; oi < g.options.length; oi++) {
              const o = g.options[oi]
              await supabase.from('options').insert({
                group_id: grp.id, name: o.name, price_delta: o.price_delta, is_available: true, sort_order: oi,
              })
            }
          }
        }
      }
    }

    setCreating(false)
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-canvas font-body text-ink flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-16 h-16 rounded-full bg-brand-tint flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0B7A47" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <h2 className="font-heading font-bold text-xl text-center">Items created!</h2>
        <p className="text-sm text-ink-2 text-center">
          {selected.size} item{selected.size !== 1 ? 's' : ''} added as drafts. Add prices and photos to submit for review.
        </p>
        <button
          type="button"
          onClick={() => router.push('/vendor/menu')}
          className="h-btn px-8 rounded-2xl bg-brand text-white font-body text-base font-bold border-0"
        >
          Go to menu
        </button>
      </div>
    )
  }

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
        <h1 className="font-heading font-extrabold text-xl">Templates</h1>
      </header>

      {/* Store type tabs */}
      <div className="px-4 pt-3 pb-2 flex gap-1 bg-white border-b border-line">
        {STORE_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => { setStoreType(t.value); setSelected(new Set()) }}
            className={`flex-1 h-9 rounded-xl font-body text-sm font-bold border-0 transition-colors ${
              storeType === t.value ? 'bg-ink text-white' : 'bg-surface text-ink-2'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="px-4 pt-3 pb-1 text-xs text-ink-2">
        Items are created as drafts. You&apos;ll add prices and photos before submitting for review.
      </p>

      <div className="px-4 py-2 flex flex-col gap-3 pb-28">
        {Object.entries(packs).map(([packName, packItems]) => {
          const allSelected = packItems.every(i => selected.has(i.templateId))
          const someSelected = packItems.some(i => selected.has(i.templateId))
          return (
            <div key={packName} className="bg-white rounded-2xl overflow-hidden">
              {/* Pack header */}
              <button
                type="button"
                onClick={() => selectPack(packItems)}
                className="w-full flex items-center justify-between px-4 py-3 border-0 bg-white"
              >
                <span className="font-bold text-[15px]">{packName}</span>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  allSelected ? 'bg-brand border-brand' : someSelected ? 'bg-brand-tint border-brand' : 'bg-white border-line'
                }`}>
                  {allSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                  {!allSelected && someSelected && <div className="w-2 h-2 rounded-sm bg-brand" />}
                </div>
              </button>

              <div className="divide-y divide-line">
                {packItems.map(it => (
                  <button
                    key={it.templateId}
                    type="button"
                    onClick={() => toggleItem(it.templateId)}
                    className="w-full flex items-start gap-3 px-4 py-3 border-0 bg-white text-left"
                  >
                    <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      selected.has(it.templateId) ? 'bg-brand border-brand' : 'bg-white border-line'
                    }`}>
                      {selected.has(it.templateId) && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink">{it.itemName}</p>
                      {it.description && (
                        <p className="text-xs text-ink-2 truncate">{it.description}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-white border-t border-line">
          <button
            type="button"
            disabled={creating}
            onClick={createItems}
            className="w-full h-btn rounded-2xl bg-brand text-white font-body text-base font-bold border-0 disabled:opacity-50"
          >
            {creating ? 'Creating…' : `Create ${selected.size} item${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}
