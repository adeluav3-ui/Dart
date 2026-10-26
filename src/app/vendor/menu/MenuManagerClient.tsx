'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/format'
import type { Vendor, MenuCategory, MenuItem } from '@/types/database'

interface Props {
  vendor: Vendor
  initialCategories: MenuCategory[]
  initialItems: MenuItem[]
}

export function MenuManagerClient({ vendor, initialCategories, initialItems }: Props) {
  const [categories, setCategories] = useState(initialCategories)
  const [items, setItems] = useState(initialItems)
  const [activeCategory, setActiveCategory] = useState(initialCategories[0]?.id ?? '')
  const [newCatName, setNewCatName] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const supabase = createClient()

  async function addCategory() {
    if (!newCatName.trim()) return
    const { data } = await supabase
      .from('menu_categories')
      .insert({ vendor_id: vendor.id, name: newCatName.trim(), sort_order: categories.length })
      .select()
      .single()
    if (data) {
      setCategories(prev => [...prev, data as MenuCategory])
      setNewCatName('')
    }
  }

  async function toggleAvailability(itemId: string, current: boolean) {
    setSaving(itemId)
    await supabase.from('menu_items').update({ is_available: !current }).eq('id', itemId)
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, is_available: !current } : i))
    setSaving(null)
  }

  const catItems = items.filter(i => i.category_id === activeCategory)

  return (
    <div className="min-h-screen bg-canvas font-body text-ink flex flex-col">
      <header className="bg-white px-5 pt-5 pb-3 border-b border-line">
        <h1 className="font-heading font-extrabold text-xl">{vendor.name} — Menu</h1>
      </header>

      {/* Category tabs */}
      <div className="flex gap-2 px-4 pt-3 overflow-x-auto scrollbar-hide">
        {categories.map(cat => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`flex-none h-9 px-4 rounded-chip text-sm font-semibold border transition-colors ${
              activeCategory === cat.id
                ? 'bg-ink text-white border-transparent'
                : 'bg-white border-line text-ink'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Add category */}
      <div className="flex gap-2 px-4 mt-2">
        <input
          type="text"
          placeholder="New category name"
          value={newCatName}
          onChange={e => setNewCatName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addCategory()}
          className="flex-1 h-9 px-3 rounded-xl border border-line text-sm font-body"
        />
        <button
          type="button"
          onClick={addCategory}
          className="h-9 px-4 rounded-xl bg-brand text-white text-sm font-bold"
        >
          Add
        </button>
      </div>

      {/* Items list */}
      <div className="px-4 mt-4 flex flex-col gap-2 pb-24">
        {catItems.map(item => (
          <div key={item.id} className="bg-white rounded-2xl p-4 flex items-center gap-3">
            <div className="flex-1 flex flex-col gap-0.5 min-w-0">
              <span className="text-base font-bold truncate">{item.name}</span>
              {item.description && (
                <span className="text-xs text-ink-2 truncate">{item.description}</span>
              )}
              <span className="text-[15px] font-bold text-brand">{formatMoney(item.base_price)}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={item.is_available}
              disabled={saving === item.id}
              onClick={() => toggleAvailability(item.id, item.is_available)}
              className={`relative w-12 h-6 rounded-full transition-colors border-0 cursor-pointer ${
                item.is_available ? 'bg-brand' : 'bg-[#C3C8CD]'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                  item.is_available ? 'left-6' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        ))}
        {catItems.length === 0 && activeCategory && (
          <p className="text-ink-2 text-sm py-6 text-center">No items in this category</p>
        )}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 h-[72px] px-3 pb-3.5 pt-2 bg-white border-t border-line grid grid-cols-3">
        <Link href="/vendor/orders" className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-ink-2 no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 4h10a1 1 0 0 1 1 1v15l-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1z"/></svg>
          Orders
        </Link>
        <Link href="/vendor/menu" className="flex flex-col items-center justify-center gap-1 text-xs font-bold text-brand no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 6h14M5 12h14M5 18h9"/></svg>
          Menu
        </Link>
        <Link href="/vendor/earnings" className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-ink-2 no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/></svg>
          Earnings
        </Link>
      </nav>
    </div>
  )
}
