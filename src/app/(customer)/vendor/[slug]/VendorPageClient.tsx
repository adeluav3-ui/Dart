'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Clock, Star } from 'lucide-react'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'
import { formatMoney } from '@/lib/format'
import { useCart, cartItemCount, cartSubtotal } from '@/store/cart'
import { ItemSheet } from './ItemSheet'
import type { Vendor, MenuCategory, MenuItem, OptionGroup, Option } from '@/types/database'

interface Props {
  vendor: Vendor
  categories: MenuCategory[]
  items: MenuItem[]
  optionGroups: OptionGroup[]
  options: Option[]
}

export function VendorPageClient({ vendor, categories, items, optionGroups, options }: Props) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? 'all')
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const { cart } = useCart()
  const showRating = vendor.rating_count >= 5

  const categoryItems = (catId: string) =>
    items.filter(i => (catId === 'all' ? true : i.category_id === catId))

  const displayCategories = categories.length > 0 ? categories : [{ id: 'all', name: 'Menu', vendor_id: vendor.id, sort_order: 0 }]

  const activeItems = categoryItems(activeCategory)

  return (
    <>
      <div className="min-h-screen bg-white flex flex-col font-body text-ink">
        {/* Cover photo */}
        <div className="relative h-[196px] flex-none bg-photo flex items-center justify-center">
          {vendor.cover_photo_url ? (
            <Image
              src={vendor.cover_photo_url}
              alt={vendor.name}
              fill
              className="object-cover"
            />
          ) : (
            <span className="text-xs text-[#6B5E4B]">Cover photo</span>
          )}
          <Link
            href="/"
            aria-label="Back to home"
            className="absolute left-4 top-4 w-11 h-11 rounded-full bg-white flex items-center justify-center shadow"
          >
            <ArrowLeft size={20} strokeWidth={2.2} />
          </Link>
        </div>

        {/* Vendor info */}
        <div className="px-5 pt-4.5 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h1 className="font-heading font-extrabold text-[26px] tracking-tight">{vendor.name}</h1>
            {vendor.is_verified && <VerifiedBadge size={20} />}
          </div>
          <span className="text-sm text-ink-2">
            {vendor.category}
            {vendor.is_verified && ' · Verified kitchen'}
          </span>
          <div className="flex gap-2 mt-1">
            {showRating && (
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface text-[13px] font-semibold">
                <svg width="14" height="14" viewBox="0 0 24 24">
                  <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="#F5A524" />
                </svg>
                {vendor.rating_avg.toFixed(1)}
                <span className="font-normal text-ink-2">({vendor.rating_count})</span>
              </span>
            )}
            <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface text-[13px] font-semibold">
              <Clock size={14} stroke="#5B6168" strokeWidth={2} />
              {vendor.avg_prep_mins}–{vendor.avg_prep_mins + 15} min
            </span>
            <span className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[13px] font-semibold ${
              vendor.is_open ? 'bg-brand-tint text-brand-ink' : 'bg-surface text-ink-2'
            }`}>
              {vendor.is_open ? 'Open' : 'Closed'}
            </span>
          </div>
        </div>

        {/* Category tabs */}
        {displayCategories.length > 1 && (
          <div
            role="tablist"
            aria-label="Menu categories"
            className="flex gap-5 px-5 mt-4 border-b border-line overflow-x-auto scrollbar-hide"
          >
            {displayCategories.map(cat => (
              <button
                key={cat.id}
                role="tab"
                type="button"
                aria-selected={activeCategory === cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`h-11 py-0 border-0 bg-transparent font-body text-[15px] whitespace-nowrap transition-colors ${
                  activeCategory === cat.id
                    ? 'font-bold text-ink border-b-[3px] border-brand'
                    : 'font-medium text-ink-2 border-b-[3px] border-transparent'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Items list */}
        <div className="px-5 flex flex-col pb-28">
          {activeItems.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              onSelect={() => setSelectedItem(item)}
            />
          ))}
          {activeItems.length === 0 && (
            <p className="text-ink-2 text-sm py-8 text-center">Nothing here yet</p>
          )}
        </div>

        {/* View cart CTA */}
        {cart && cart.vendorId === vendor.id && cartItemCount(cart) > 0 && (
          <div className="fixed bottom-0 left-0 right-0 px-4 pb-5 bg-white">
            <Link
              href="/checkout"
              className="flex items-center justify-between h-btn px-5 rounded-2xl bg-brand text-white no-underline"
            >
              <span className="flex items-center gap-2.5 text-[15px] font-bold">
                <span className="min-w-[26px] h-[26px] rounded-full bg-white text-brand text-[13px] flex items-center justify-center font-bold">
                  {cartItemCount(cart)}
                </span>
                View cart
              </span>
              <span className="text-base font-bold">{formatMoney(cartSubtotal(cart))}</span>
            </Link>
          </div>
        )}
      </div>

      {/* Item bottom sheet */}
      {selectedItem && (
        <ItemSheet
          item={selectedItem}
          vendor={vendor}
          optionGroups={optionGroups.filter(g => g.item_id === selectedItem.id)}
          options={options}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  )
}

function ItemRow({ item, onSelect }: { item: MenuItem; onSelect: () => void }) {
  if (!item.is_available) {
    return (
      <div className="flex gap-3.5 py-4 border-b border-[#EEF0F2] text-[#8A9097]">
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <span className="text-base font-bold text-[#6B7178]">{item.name}</span>
          {item.description && (
            <span className="text-[13px] leading-snug text-[#6B7178]">{item.description}</span>
          )}
          <span className="self-start mt-1 text-xs font-bold px-2 py-0.5 rounded-lg bg-surface text-ink-2">Sold out today</span>
        </div>
        <div className="w-24 h-24 flex-none rounded-[14px] bg-surface flex items-center justify-center">
          <span className="text-[11px] text-[#6B7178]">Photo</span>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex gap-3.5 py-4 border-b border-[#EEF0F2] text-left w-full"
    >
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <span className="text-base font-bold">{item.name}</span>
        {item.description && (
          <span className="text-[13px] leading-snug text-ink-2 line-clamp-2">{item.description}</span>
        )}
        {item.pack_size && (
          <span className="text-[13px] text-ink-2">{item.pack_size}</span>
        )}
        <span className="text-[15px] font-bold mt-1">{formatMoney(item.base_price)}</span>
      </div>
      <div className="relative w-24 h-24 flex-none rounded-[14px] bg-photo flex items-center justify-center overflow-hidden">
        {item.photo_url ? (
          <Image src={item.photo_url} alt={item.name} fill className="object-cover" />
        ) : (
          <span className="text-[11px] text-[#6B5E4B]">Photo</span>
        )}
        <span
          aria-hidden="true"
          className="absolute -right-1.5 -bottom-1.5 w-[34px] h-[34px] rounded-full bg-brand flex items-center justify-center shadow-[0_0_0_3px_white]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </div>
    </button>
  )
}
