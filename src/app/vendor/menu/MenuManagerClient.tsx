'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/format'
import { VendorNav } from '@/components/vendor/VendorNav'
import type { Vendor, MenuCategory, MenuItem, MenuItemStatus } from '@/types/database'

interface Props {
  vendor: Vendor
  initialCategories: MenuCategory[]
  initialItems: MenuItem[]
}

const STATUS_LABEL: Record<MenuItemStatus, string> = {
  draft:     'Draft',
  in_review: 'In review',
  live:      'Live',
  rejected:  'Rejected',
}

const STATUS_COLOR: Record<MenuItemStatus, string> = {
  draft:     'bg-surface text-ink-2',
  in_review: 'bg-warn-tint text-warn',
  live:      'bg-brand-tint text-brand-ink',
  rejected:  'bg-red-50 text-danger',
}

export function MenuManagerClient({ vendor, initialCategories, initialItems }: Props) {
  const [categories, setCategories] = useState(initialCategories)
  const [items, setItems] = useState(initialItems)
  const [activeCategory, setActiveCategory] = useState<string>(
    initialCategories[0]?.id ?? '__all__'
  )
  // Category add / rename state
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [savingCat, setSavingCat] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const newCatInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (addingCategory) newCatInputRef.current?.focus()
  }, [addingCategory])

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus()
  }, [renamingId])

  const draftCount = items.filter(i => i.status === 'draft').length
  const rejectedCount = items.filter(i => i.status === 'rejected').length
  const missingInStorePrice = items.filter(
    i => i.status === 'live' && i.in_store_price_kobo == null
  ).length
  const incompleteBannerCount = draftCount + rejectedCount

  const catItems = activeCategory === '__all__'
    ? items
    : items.filter(i => i.category_id === activeCategory)

  async function addCategory() {
    const name = newCatName.trim()
    if (!name) { setAddingCategory(false); return }
    setSavingCat(true)
    const { data, error } = await supabase
      .from('menu_categories')
      .insert({ vendor_id: vendor.id, name, sort_order: categories.length })
      .select()
      .single()
    setSavingCat(false)
    if (error || !data) return
    setCategories(prev => [...prev, data])
    setActiveCategory(data.id)
    setNewCatName('')
    setAddingCategory(false)
  }

  async function renameCategory(id: string) {
    const name = renameValue.trim()
    if (!name) { setRenamingId(null); return }
    await supabase.from('menu_categories').update({ name }).eq('id', id)
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c))
    setRenamingId(null)
  }

  async function deleteCategory(id: string) {
    if (items.some(i => i.category_id === id)) return
    await supabase.from('menu_categories').delete().eq('id', id)
    setCategories(prev => prev.filter(c => c.id !== id))
    if (activeCategory === id) setActiveCategory('__all__')
  }

  async function toggleSoldOut(item: MenuItem) {
    const next = !item.is_sold_out
    await supabase.from('menu_items').update({ is_sold_out: next }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_sold_out: next } : i))
  }

  function itemCountFor(catId: string) {
    return catId === '__all__'
      ? items.length
      : items.filter(i => i.category_id === catId).length
  }

  return (
    <div className="min-h-screen bg-canvas font-body text-ink flex flex-col">
      {/* Header */}
      <header className="bg-white px-5 pt-5 pb-3 border-b border-line flex items-center justify-between">
        <h1 className="font-heading font-extrabold text-xl">Menu</h1>
        <Link
          href="/vendor/menu/templates"
          className="text-sm font-semibold text-brand no-underline"
        >
          Use templates
        </Link>
      </header>

      {/* Incomplete banner */}
      {incompleteBannerCount > 0 && (
        <div className="mx-4 mt-3 px-4 py-3 bg-warn-tint rounded-2xl flex items-start gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A4B08" strokeWidth="2" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm text-warn font-medium leading-snug">
            {incompleteBannerCount === 1
              ? '1 item needs attention'
              : `${incompleteBannerCount} items need attention`}
            {draftCount > 0 && ` — ${draftCount} draft${draftCount > 1 ? 's' : ''} missing price or photo`}
            {rejectedCount > 0 && ` — ${rejectedCount} rejected`}
          </p>
        </div>
      )}

      {/* Missing in-store price banner */}
      {missingInStorePrice > 0 && (
        <div className="mx-4 mt-2 px-4 py-3 bg-surface rounded-2xl flex items-start gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B6168" strokeWidth="2" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm text-ink-2 font-medium leading-snug">
            {missingInStorePrice === 1
              ? '1 live item is missing its in-store price'
              : `${missingInStorePrice} live items are missing their in-store price`}
            {' '}— tap each item to add it.
          </p>
        </div>
      )}

      {/* Category chips + management */}
      <div className="flex gap-2 px-4 pt-3 pb-1 overflow-x-auto scrollbar-hide items-center">
        {/* All */}
        <button
          type="button"
          onClick={() => setActiveCategory('__all__')}
          className={`flex-none h-9 px-4 rounded-full text-sm font-semibold border transition-colors whitespace-nowrap ${
            activeCategory === '__all__'
              ? 'bg-ink text-white border-transparent'
              : 'bg-white border-line text-ink'
          }`}
        >
          All · {items.length}
        </button>

        {categories.map(cat => {
          const isActive = activeCategory === cat.id
          const isEmpty = !items.some(i => i.category_id === cat.id)
          const isRenaming = renamingId === cat.id

          if (isRenaming) {
            return (
              <div key={cat.id} className="flex items-center gap-1 flex-none">
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={() => renameCategory(cat.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') renameCategory(cat.id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  className="h-9 px-3 rounded-full border-2 border-brand text-sm font-semibold bg-white focus:outline-none w-28"
                />
              </div>
            )
          }

          return (
            <div key={cat.id} className="flex items-center gap-1 flex-none">
              <button
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`h-9 px-4 rounded-full text-sm font-semibold border transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-ink text-white border-transparent'
                    : 'bg-white border-line text-ink'
                }`}
              >
                {cat.name} · {itemCountFor(cat.id)}
              </button>
              {/* Edit/delete controls — always show small icon */}
              <button
                type="button"
                aria-label={`Rename ${cat.name}`}
                onClick={() => { setRenamingId(cat.id); setRenameValue(cat.name) }}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-surface text-ink-2 hover:bg-line shrink-0"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              {isEmpty && (
                <button
                  type="button"
                  aria-label={`Delete ${cat.name}`}
                  onClick={() => deleteCategory(cat.id)}
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-surface text-ink-2 hover:bg-red-50 hover:text-danger shrink-0"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              )}
            </div>
          )
        })}

        {/* Add new category */}
        {addingCategory ? (
          <div className="flex items-center gap-1 flex-none">
            <input
              ref={newCatInputRef}
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onBlur={addCategory}
              onKeyDown={e => {
                if (e.key === 'Enter') addCategory()
                if (e.key === 'Escape') { setAddingCategory(false); setNewCatName('') }
              }}
              placeholder="Category name"
              disabled={savingCat}
              className="h-9 px-3 rounded-full border-2 border-brand text-sm font-semibold bg-white focus:outline-none w-36 disabled:opacity-50"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingCategory(true)}
            className="flex-none h-9 px-3 rounded-full text-sm font-semibold border border-dashed border-line text-ink-2 flex items-center gap-1.5 whitespace-nowrap hover:border-brand hover:text-brand transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Category
          </button>
        )}
      </div>

      {/* Items list */}
      <div className="px-4 mt-3 flex flex-col gap-2 pb-28">
        {catItems.length === 0 && (
          <p className="text-ink-2 text-sm py-8 text-center">
            No items yet.{' '}
            <Link href="/vendor/menu/new" className="text-brand font-semibold no-underline">
              Add one
            </Link>
          </p>
        )}

        {catItems.map(item => (
          <Link
            key={item.id}
            href={`/vendor/menu/${item.id}`}
            className="bg-white rounded-2xl p-3.5 flex items-center gap-3 no-underline"
          >
            {/* Photo thumbnail */}
            <div className="w-16 h-16 rounded-xl bg-photo shrink-0 overflow-hidden flex items-center justify-center">
              {item.photo_url ? (
                <Image
                  src={item.photo_url}
                  alt={item.name}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8A98C" strokeWidth="1.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[15px] font-bold text-ink truncate">{item.name}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${STATUS_COLOR[item.status]}`}>
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
              <span className={`text-[14px] font-semibold ${item.base_price > 0 ? 'text-brand' : 'text-ink-2'}`}>
                {item.base_price > 0 ? formatMoney(item.base_price) : 'No price set'}
              </span>
            </div>

            {/* Sold-out toggle */}
            <button
              type="button"
              role="switch"
              aria-checked={item.is_sold_out}
              aria-label="Sold out"
              onClick={e => { e.preventDefault(); toggleSoldOut(item) }}
              className={`relative w-11 h-6 rounded-full transition-colors border-0 cursor-pointer shrink-0 ${
                item.is_sold_out ? 'bg-[#C3C8CD]' : 'bg-brand'
              }`}
              title={item.is_sold_out ? 'Mark as available' : 'Mark as sold out'}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                  item.is_sold_out ? 'left-0.5' : 'left-5'
                }`}
              />
            </button>

            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-2 shrink-0">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        ))}
      </div>

      {/* Floating add button */}
      <Link
        href="/vendor/menu/new"
        className="fixed bottom-[88px] right-4 w-14 h-14 rounded-full bg-brand text-white flex items-center justify-center shadow-lg no-underline"
        aria-label="Add item"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </Link>

      <VendorNav />
    </div>
  )
}
