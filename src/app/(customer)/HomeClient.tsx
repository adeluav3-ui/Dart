'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Search, MapPin, ChevronDown, ShoppingCart, Clock, ShieldCheck } from 'lucide-react'
import { DartLogo } from '@/components/ui/DartLogo'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'
import { formatMoney } from '@/lib/format'
import { useCart, cartItemCount, cartSubtotal } from '@/store/cart'
import type { Vendor, Zone, VendorType } from '@/types/database'

const STORE_TYPES: { label: string; value: VendorType | 'all' }[] = [
  { label: 'Food', value: 'restaurant' },
  { label: 'Supermarket', value: 'supermarket' },
  { label: 'Pharmacy', value: 'pharmacy' },
]

const FOOD_CATEGORIES = ['All', 'Rice', 'Swallow', 'Grills', 'Snacks', 'Drinks']

interface Props {
  vendors: Vendor[]
  zones: Zone[]
}

export function HomeClient({ vendors, zones }: Props) {
  const [storeType, setStoreType] = useState<VendorType | 'all'>('restaurant')
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const { cart } = useCart()
  const itemCount = cart ? cartItemCount(cart) : 0

  const filtered = useMemo(() => {
    return vendors.filter(v => {
      if (storeType !== 'all' && v.type !== storeType) return false
      if (search && !v.name.toLowerCase().includes(search.toLowerCase()) &&
          !v.category?.toLowerCase().includes(search.toLowerCase())) return false
      if (category !== 'All' && storeType === 'restaurant' &&
          !v.category?.toLowerCase().includes(category.toLowerCase())) return false
      return true
    })
  }, [vendors, storeType, category, search])

  const open = filtered.filter(v => v.is_open)
  const closed = filtered.filter(v => !v.is_open)

  return (
    <div className={`flex flex-col font-body text-ink ${itemCount > 0 ? 'pb-nav-cart' : 'pb-nav'}`}>
      {/* Logo bar */}
      <div
        className="flex items-center justify-between px-4 pt-4 pb-1"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}
      >
        <DartLogo />
        <Link
          href="/checkout"
          className="relative w-11 h-11 rounded-full border border-line bg-white flex items-center justify-center"
        >
          <ShoppingCart size={20} />
          {itemCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand text-white text-[11px] font-bold flex items-center justify-center">
              {itemCount}
            </span>
          )}
        </Link>
      </div>

      {/* Deliver to */}
      <div className="px-4 pt-2 pb-3">
        <button type="button" className="flex items-center gap-2.5 min-h-[44px] text-left">
          <span className="w-9 h-9 rounded-full bg-brand-tint flex items-center justify-center flex-none">
            <MapPin size={18} stroke="#0B7A47" />
          </span>
          <span className="flex flex-col">
            <span className="text-xs text-ink-2">Deliver to</span>
            <span className="text-[15px] font-bold flex items-center gap-1">
              {zones[0]?.name ?? 'Select area'}
              <ChevronDown size={14} strokeWidth={2.2} />
            </span>
          </span>
        </button>
      </div>

      <div className="px-4 flex flex-col gap-3.5">
        <h1 className="font-heading font-extrabold text-[28px] leading-tight tracking-tight">
          What are you{'\n'}ordering today?
        </h1>

        {/* Search */}
        <label className="flex items-center gap-2.5 h-12 px-3.5 rounded-[14px] bg-surface">
          <Search size={18} stroke="#5B6168" />
          <input
            type="search"
            placeholder={
              storeType === 'restaurant' ? 'Search jollof, amala, shawarma…' :
              storeType === 'supermarket' ? 'Search groceries, provisions…' :
              'Search medicine, vitamins…'
            }
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent font-body text-[15px] text-ink outline-none placeholder:text-ink-2/60"
          />
        </label>

        {/* Store type tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
          {STORE_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => { setStoreType(t.value); setCategory('All') }}
              className={`flex-none h-9 px-4 rounded-chip font-semibold text-sm transition-colors ${
                storeType === t.value
                  ? 'bg-ink text-white'
                  : 'bg-white border border-line text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Category chips (food only) */}
        {storeType === 'restaurant' && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
            {FOOD_CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`flex-none h-9 px-4 rounded-chip font-semibold text-sm transition-colors ${
                  category === cat
                    ? 'bg-ink text-white'
                    : 'bg-white border border-line text-ink'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Trust banner */}
        <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-[14px] bg-brand-tint">
          <ShieldCheck size={20} stroke="#0B7A47" strokeWidth={2} />
          <span className="text-[13px] leading-snug text-brand-ink">
            <b>Every kitchen visited by us.</b> Photos are real food from that vendor.
          </span>
        </div>

        {/* Open now */}
        {open.length > 0 && (
          <>
            <h2 className="font-heading font-bold text-xl mt-1.5">Open now</h2>
            <div className="flex flex-col gap-4">
              {open.map(v => <VendorCard key={v.id} vendor={v} />)}
            </div>
          </>
        )}

        {/* Closed */}
        {closed.length > 0 && (
          <>
            <h2 className="font-heading font-bold text-xl mt-2 text-ink-2">Closed</h2>
            <div className="flex flex-col gap-4 opacity-60">
              {closed.map(v => <VendorCard key={v.id} vendor={v} />)}
            </div>
          </>
        )}

        {filtered.length === 0 && (
          <p className="text-center text-ink-2 py-12">No vendors found</p>
        )}
      </div>

      {/* Cart bar — fixed, sits above bottom nav */}
      {itemCount > 0 && (
        <div
          className="fixed inset-x-0 px-4 z-40"
          style={{ bottom: 'calc(64px + env(safe-area-inset-bottom) + 8px)' }}
        >
          <div className="max-w-md mx-auto">
            <Link
              href="/checkout"
              className="flex items-center justify-between h-btn px-5 rounded-2xl bg-brand text-white shadow-lg"
            >
              <span className="flex items-center gap-2.5 text-[15px] font-bold">
                <span className="min-w-[26px] h-[26px] rounded-full bg-white text-brand text-[13px] flex items-center justify-center font-bold">
                  {itemCount}
                </span>
                View cart
              </span>
              <span className="text-base font-bold">{formatMoney(cartSubtotal(cart!))}</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function VendorCard({ vendor }: { vendor: Vendor }) {
  const showRating = vendor.rating_count >= 5

  return (
    <Link
      href={`/vendor/${vendor.slug}`}
      className="flex gap-3 items-stretch no-underline text-ink"
    >
      <div className="w-[104px] h-[88px] flex-none rounded-[14px] bg-photo flex items-center justify-center overflow-hidden">
        {vendor.cover_photo_url ? (
          <Image
            src={vendor.cover_photo_url}
            alt={vendor.name}
            width={104}
            height={88}
            className="object-cover w-full h-full"
          />
        ) : (
          <span className="text-[11px] text-[#6B5E4B] text-center px-2 leading-snug">Photo</span>
        )}
      </div>
      <div className="flex flex-col justify-center gap-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-base font-bold truncate">{vendor.name}</span>
          {vendor.is_verified && <VerifiedBadge size={16} />}
        </div>
        <span className="text-[13px] text-ink-2 truncate">{vendor.category}</span>
        <div className="flex items-center gap-2.5 text-[13px]">
          <span className="flex items-center gap-1">
            <Clock size={14} stroke="#5B6168" strokeWidth={2} />
            {vendor.avg_prep_mins}–{vendor.avg_prep_mins + 15} min
          </span>
          {showRating ? (
            <span className="flex items-center gap-1 font-semibold">
              <svg width="14" height="14" viewBox="0 0 24 24">
                <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="#F5A524" />
              </svg>
              {vendor.rating_avg.toFixed(1)}
              <span className="font-normal text-ink-2">({vendor.rating_count})</span>
            </span>
          ) : (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface text-ink-2">New</span>
          )}
        </div>
      </div>
    </Link>
  )
}
