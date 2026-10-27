'use client'

import { useState } from 'react'
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
  const supabase = createClient()

  const draftCount = items.filter(i => i.status === 'draft').length
  const rejectedCount = items.filter(i => i.status === 'rejected').length
  const incompleteBannerCount = draftCount + rejectedCount

  const catItems = activeCategory === '__all__'
    ? items
    : items.filter(i => i.category_id === activeCategory)

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

      {/* Category chips */}
      <div className="flex gap-2 px-4 pt-3 overflow-x-auto scrollbar-hide">
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
        {categories.map(cat => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`flex-none h-9 px-4 rounded-full text-sm font-semibold border transition-colors whitespace-nowrap ${
              activeCategory === cat.id
                ? 'bg-ink text-white border-transparent'
                : 'bg-white border-line text-ink'
            }`}
          >
            {cat.name} · {itemCountFor(cat.id)}
          </button>
        ))}
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
                {item.pending_price != null && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700">
                    Price change pending
                  </span>
                )}
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
