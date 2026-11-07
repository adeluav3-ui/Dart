'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Search, MapPin, ChevronDown, ShoppingCart, Clock, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'
import { AreaPicker } from '@/components/AreaPicker'
import { formatMoney, areaDisplayName } from '@/lib/format'
import { useCart, cartItemCount, cartSubtotal } from '@/store/cart'
import { estimateDeliveryDistance, calcDeliveryPrice } from '@/lib/pricing/delivery'
import { findCoveringArea } from '@/lib/coverageCircles'
import type { Vendor, Zone, Area, VendorType, DeliveryPricingSettings } from '@/types/database'

interface DeliveryPin {
  areaId: string | null
  areaName: string
  lat: number
  lng: number
  description?: string
  label?: string
}

const deliveryKey = (userId: string | null) => `dart_delivery_${userId ?? 'guest'}`

const STORE_TYPES: { label: string; value: VendorType | 'all' }[] = [
  { label: 'Food', value: 'restaurant' },
  { label: 'Supermarket', value: 'supermarket' },
  { label: 'Pharmacy', value: 'pharmacy' },
]

const FOOD_CATEGORIES = ['All', 'Rice', 'Swallow', 'Grills', 'Snacks', 'Drinks']

interface Props {
  userId: string | null
  vendors: (Vendor & { menuCategoryNames: string[] })[]
  zones: Zone[]
  areas: Area[]
  pricingSettings: DeliveryPricingSettings | null
  coverageAreas?: unknown[]
}

export function HomeClient({ userId, vendors, zones, areas, pricingSettings }: Props) {
  const [storeType, setStoreType] = useState<VendorType | 'all'>('restaurant')
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [pin, setPin] = useState<DeliveryPin | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const { cart } = useCart()
  const itemCount = cart ? cartItemCount(cart) : 0

  // Hydrate pin from localStorage on mount
  useEffect(() => {
    const raw = localStorage.getItem(deliveryKey(userId))
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DeliveryPin
        if (parsed.areaId) {
          const area = areas.find(a => a.id === parsed.areaId && a.is_active !== false && a.status === 'active')
          if (!area) { setPin({ ...parsed, areaId: null }); return }
        }
        setPin(parsed)
        return
      } catch {}
    }
    // No pin saved yet — open picker
    if (areas.some(a => a.status === 'active' && a.is_active !== false)) {
      setPickerOpen(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areas, userId])

  function savePin(areaId: string | null, areaName: string, lat: number, lng: number, description: string, label?: string) {
    const newPin: DeliveryPin = { areaId, areaName, lat, lng, description, label }
    setPin(newPin)
    localStorage.setItem(deliveryKey(userId), JSON.stringify(newPin))
    setPickerOpen(false)
  }

  const maxDistanceM = pricingSettings?.max_distance_m ?? 6000

  function estimatedFeeForVendor(vendor: Vendor): number | null {
    if (!pin || vendor.lat == null || vendor.lng == null) return null
    const distM = estimateDeliveryDistance(vendor.lat, vendor.lng, pin.lat, pin.lng)
    if (!pricingSettings || distM > maxDistanceM) return null
    return calcDeliveryPrice(distM, pricingSettings).okada_fare
  }

  function vendorDistanceM(vendor: Vendor): number | null {
    if (!pin || vendor.lat == null || vendor.lng == null) return null
    return estimateDeliveryDistance(vendor.lat, vendor.lng, pin.lat, pin.lng)
  }

  const filtered = useMemo(() => {
    return vendors.filter(v => {
      // Never show vendors without a shop pin
      if (v.lat == null || v.lng == null) return false
      if (storeType !== 'all' && v.type !== storeType) return false
      if (search && !v.name.toLowerCase().includes(search.toLowerCase()) &&
          !v.category?.toLowerCase().includes(search.toLowerCase())) return false
      if (category !== 'All' && storeType === 'restaurant') {
        const chip = category.toLowerCase()
        const inVendorCategory = v.category?.toLowerCase().includes(chip) ?? false
        const inMenuCategories = v.menuCategoryNames.some(n => n.toLowerCase().includes(chip))
        if (!inVendorCategory && !inMenuCategories) return false
      }
      // Hide vendors where the straight-line estimate is already over max_distance_m
      if (pin) {
        const distM = estimateDeliveryDistance(v.lat, v.lng, pin.lat, pin.lng)
        if (distM > maxDistanceM) return false
      }
      return true
    })
  }, [vendors, storeType, category, search, pin, maxDistanceM])

  const open = filtered.filter(v => v.is_open)
  const closed = filtered.filter(v => !v.is_open)

  const displayName = pin?.description
    ? (pin.label ? `${pin.label} · ${pin.description}` : pin.description)
    : (pin?.areaName ?? 'Select area')
  const pinOutsideCoverage = pin
    ? (pin.areaId
        ? !areas.some(a => a.id === pin.areaId && a.is_active !== false && a.status === 'active')
        : !findCoveringArea(pin.lat, pin.lng, areas))
    : false

  return (
    <>
      <div className={`flex flex-col font-body text-ink ${itemCount > 0 ? 'pb-nav-cart' : 'pb-nav'}`}>
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-4 pt-4 pb-1"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}
        >
          <Logo height={28} />
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

        {/* Deliver-to button */}
        <div className="px-4 pt-2 pb-3">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-2.5 min-h-[44px] text-left"
          >
            <span className="w-8 h-8 rounded-full bg-brand-tint flex items-center justify-center flex-none">
              <MapPin size={16} stroke="#0B7A47" />
            </span>
            <span className="flex flex-col min-w-0">
              <span className="text-[11px] text-ink-2">Deliver to</span>
              <span className="text-[14px] font-bold flex items-center gap-1 leading-snug">
                <span className="truncate">{displayName}</span>
                <ChevronDown size={13} strokeWidth={2.2} className="shrink-0" />
              </span>
              {pin?.description && (
                <span className="text-[11px] leading-snug" style={{ color: '#5B6168' }}>
                  Near {pin.areaName}
                </span>
              )}
            </span>
          </button>

          {/* Outside coverage banner */}
          {pinOutsideCoverage && (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="mt-1 w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-warn-tint text-warn text-[13px] font-semibold text-left"
            >
              <span className="flex-1">We don&apos;t deliver to your spot yet.</span>
              <span className="text-warn underline underline-offset-2">Change spot</span>
            </button>
          )}
        </div>

        <div className="px-4 flex flex-col gap-3">
          <h1 className="font-heading font-extrabold text-[20px] leading-snug tracking-tight">
            What are you ordering today?
          </h1>

          {/* Search */}
          <label className="flex items-center gap-2.5 h-11 px-3.5 rounded-[14px] bg-surface">
            <Search size={16} stroke="#5B6168" />
            <input
              type="search"
              placeholder={
                storeType === 'restaurant' ? 'Search jollof, amala, shawarma…' :
                storeType === 'supermarket' ? 'Search groceries, provisions…' :
                'Search medicine, vitamins…'
              }
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent font-body text-[14px] text-ink outline-none placeholder:text-ink-2/60"
            />
          </label>

          {/* Store type tabs */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
            {STORE_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => { setStoreType(t.value); setCategory('All') }}
                className={`flex-none h-8 px-4 rounded-chip font-semibold text-[13px] transition-colors ${
                  storeType === t.value
                    ? 'bg-ink text-white'
                    : 'bg-white border border-line text-ink'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Category chips */}
          {storeType === 'restaurant' && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
              {FOOD_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`flex-none h-8 px-4 rounded-chip font-semibold text-[13px] transition-colors ${
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
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-[14px] bg-brand-tint">
            <ShieldCheck size={18} stroke="#0B7A47" strokeWidth={2} />
            <span className="text-[12px] leading-snug text-brand-ink">
              <b>Every kitchen visited by us.</b> Photos are real food from that vendor.
            </span>
          </div>

          {open.length > 0 && (
            <>
              <h2 className="font-heading font-bold text-[16px] mt-1">Open now</h2>
              <div className="flex flex-col gap-3.5">
                {open.map(v => (
                  <VendorCard key={v.id} vendor={v} estimatedFee={estimatedFeeForVendor(v)} />
                ))}
              </div>
            </>
          )}

          {closed.length > 0 && (
            <>
              <h2 className="font-heading font-bold text-[16px] mt-1 text-ink-2">Closed</h2>
              <div className="flex flex-col gap-3.5 opacity-60">
                {closed.map(v => (
                  <VendorCard key={v.id} vendor={v} estimatedFee={estimatedFeeForVendor(v)} />
                ))}
              </div>
            </>
          )}

          {filtered.length === 0 && (
            <p className="text-center text-ink-2 py-10 text-sm">
              {pin ? 'No vendors in your area yet' : 'Set your delivery spot to see vendors'}
            </p>
          )}
        </div>

        {/* Cart bar */}
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
                <span className="text-[15px] font-bold">{formatMoney(cartSubtotal(cart!))}</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Area picker */}
      {pickerOpen && (
        <AreaPicker
          areas={areas}
          zones={zones}
          selectedId={pin?.areaId ?? ''}
          onSave={savePin}
          onClose={pin ? () => setPickerOpen(false) : undefined}
          userId={userId}
        />
      )}
    </>
  )
}

function VendorCard({ vendor, estimatedFee }: { vendor: Vendor; estimatedFee: number | null }) {
  const showRating = vendor.rating_count >= 5

  return (
    <Link
      href={`/vendor/${vendor.slug}`}
      className="flex gap-3 items-stretch no-underline text-ink"
    >
      <div className="w-[96px] h-[80px] flex-none rounded-[14px] bg-photo flex items-center justify-center overflow-hidden">
        {vendor.cover_photo_url ? (
          <Image
            src={vendor.cover_photo_url}
            alt={vendor.name}
            width={96}
            height={80}
            className="object-cover w-full h-full"
          />
        ) : (
          <span className="text-[11px] text-[#6B5E4B] text-center px-2 leading-snug">Photo</span>
        )}
      </div>
      <div className="flex flex-col justify-center gap-0.5 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[14px] font-bold truncate">{vendor.name}</span>
          {vendor.is_verified && <VerifiedBadge size={14} />}
        </div>
        <span className="text-[12px] text-ink-2 truncate">{vendor.category}</span>
        <div className="flex items-center gap-2 text-[12px]">
          <span className="flex items-center gap-1">
            <Clock size={13} stroke="#5B6168" strokeWidth={2} />
            {vendor.avg_prep_mins}–{vendor.avg_prep_mins + 15} min
          </span>
          {showRating ? (
            <span className="flex items-center gap-1 font-semibold">
              <svg width="13" height="13" viewBox="0 0 24 24">
                <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="#F5A524" />
              </svg>
              {vendor.rating_avg.toFixed(1)}
            </span>
          ) : (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-warn-tint text-warn font-semibold">New</span>
          )}
          {estimatedFee != null && (
            <span className="text-ink-2">· Delivery ~{formatMoney(estimatedFee)}</span>
          )}
        </div>
      </div>
    </Link>
  )
}
