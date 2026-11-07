'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Lock, Info, Trash2, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/format'
import { useCart, cartSubtotal } from '@/store/cart'
import { calcServiceFee, type ServiceFeeSettings } from '@/lib/serviceFee'
import { Button } from '@/components/ui/Button'
import { AreaPicker } from '@/components/AreaPicker'
import { findCoveringArea } from '@/lib/coverageCircles'
import type { Zone, Area } from '@/types/database'

interface DeliveryPin {
  areaId: string | null
  areaName: string
  lat: number
  lng: number
  description?: string
  label?: string
}

interface DeliveryQuote {
  delivery_fee: number
  distance_m: number
  source: string
  too_far: boolean
  vendor_name: string
}

interface Props {
  userId: string | null
  zones: Zone[]
  areas: Area[]
  feeSettings: ServiceFeeSettings
  coverageAreas?: unknown[]
}

const deliveryKey = (userId: string | null) => `dart_delivery_${userId ?? 'guest'}`

export function CheckoutClient({ userId, zones, areas, feeSettings }: Props) {
  const { cart, clearCart } = useCart()
  const router = useRouter()
  const supabase = createClient()

  const [pin, setPin] = useState<DeliveryPin | null>(null)
  const [landmark, setLandmark] = useState('')
  const [details, setDetails] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [feeInfoOpen, setFeeInfoOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [quote, setQuote] = useState<DeliveryQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const submittingRef = useRef(false)

  // Hydrate pin from localStorage
  useEffect(() => {
    const raw = localStorage.getItem(deliveryKey(userId))
    if (raw) {
      try { setPin(JSON.parse(raw) as DeliveryPin) } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Fetch delivery quote whenever the pin or cart vendor changes
  useEffect(() => {
    if (!pin || !cart) { setQuote(null); return }

    setQuoteLoading(true)
    fetch('/api/delivery-quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendorId: cart.vendorId, pinLat: pin.lat, pinLng: pin.lng }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.error) setQuote(data as DeliveryQuote)
        else setQuote(null)
      })
      .catch(() => setQuote(null))
      .finally(() => setQuoteLoading(false))
  }, [pin?.lat, pin?.lng, cart?.vendorId])

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-ink-2">Your cart is empty</p>
        <Link href="/" className="text-brand font-semibold underline">Back to home</Link>
      </div>
    )
  }

  const subtotal = cartSubtotal(cart)
  const deliveryFee = quote?.delivery_fee ?? 0
  const selectedArea = pin?.areaId ? areas.find(a => a.id === pin.areaId) : null
  const isGatePickup = selectedArea?.gate_pickup ?? false
  const serviceFee = calcServiceFee(subtotal, feeSettings)
  const total = subtotal + deliveryFee + serviceFee

  function savePin(areaId: string | null, areaName: string, lat: number, lng: number, description: string, label?: string) {
    const newPin: DeliveryPin = { areaId, areaName, lat, lng, description, label }
    setPin(newPin)
    localStorage.setItem(deliveryKey(userId), JSON.stringify(newPin))
    setPickerOpen(false)
  }

  // Pre-fill landmark from saved pin description
  useEffect(() => {
    if (pin?.description && !landmark) setLandmark(pin.description)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin?.description])

  async function placeOrder() {
    if (submittingRef.current) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent('/checkout')}`)
      return
    }
    if (!pin) { setError('Select your delivery area'); return }
    if (quote?.too_far) { setError('Your pin is too far from this vendor'); return }
    if (!isGatePickup && !landmark.trim()) { setError('Landmark is required'); return }
    if (!phone.trim()) { setError('Enter a phone number for the rider to call'); return }

    submittingRef.current = true
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart,
          areaId: pin.areaId,
          pinLat: pin.lat,
          pinLng: pin.lng,
          landmark: landmark.trim(),
          details: details.trim() || null,
          phone: phone.trim(),
        }),
      })

      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Something went wrong'); return }
      if (json.checkoutUrl) { clearCart(); window.location.href = json.checkoutUrl }
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }

  function formatDistance(m: number) {
    return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col font-body text-ink">
      <header className="flex items-center gap-2 px-4 pt-4 pb-2 bg-canvas">
        <Link href={`/vendor/${cart.vendorSlug}`} aria-label="Back" className="w-11 h-11 flex items-center justify-center">
          <ArrowLeft size={22} strokeWidth={2.2} />
        </Link>
        <h1 className="font-heading font-extrabold text-2xl">Checkout</h1>
      </header>

      <div className="px-4 flex flex-col gap-3">
        {/* Order summary */}
        <section className="bg-white rounded-2xl p-4">
          <div className="flex justify-between items-center">
            <h2 className="text-[15px] font-bold">{cart.vendorName}</h2>
            <div className="flex items-center gap-3">
              {confirmClear ? (
                <>
                  <button type="button" onClick={() => setConfirmClear(false)}
                    className="text-[13px] text-ink-2 bg-transparent border-0 cursor-pointer p-0">
                    Cancel
                  </button>
                  <button type="button" onClick={() => { clearCart(); router.push('/') }}
                    className="text-[13px] font-semibold text-danger bg-transparent border-0 cursor-pointer p-0">
                    Clear cart
                  </button>
                </>
              ) : (
                <>
                  <Link href={`/vendor/${cart.vendorSlug}`} className="text-[13px] font-semibold text-brand no-underline">Add items</Link>
                  <button type="button" onClick={() => setConfirmClear(true)} aria-label="Clear cart"
                    className="w-8 h-8 flex items-center justify-center text-ink-2 bg-transparent border-0 cursor-pointer rounded-lg hover:bg-surface -mr-1">
                    <Trash2 size={16} strokeWidth={2} />
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3 mt-3">
            {cart.items.map((ci, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="text-[13px] font-bold px-1.5 py-0.5 rounded-md bg-surface">{ci.qty}&times;</span>
                <span className="flex-1 flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{ci.item.name}</span>
                  {ci.selectedOptions.flatMap(s => s.options).length > 0 && (
                    <span className="text-[13px] text-ink-2">
                      {ci.selectedOptions.flatMap(s => s.options).map(o => o.name).join(', ')}
                    </span>
                  )}
                </span>
                <span className="text-sm font-semibold">{formatMoney(ci.lineTotal)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Delivery address */}
        <section className="bg-white rounded-2xl p-4 flex flex-col gap-2.5">
          <h2 className="text-[15px] font-bold">Deliver to</h2>

          {/* Delivery pin selector */}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl border border-line text-left hover:bg-surface transition-colors"
          >
            <MapPin size={18} stroke="#0B7A47" className="flex-none" />
            <span className="flex-1 flex flex-col min-w-0">
              <span className="text-xs font-semibold text-ink-2">Delivery spot</span>
              {pin ? (
                <>
                  <span className="text-[14px] font-semibold text-ink leading-snug truncate">
                    {pin.label ? `${pin.label} · ` : ''}{pin.description || pin.areaName}
                  </span>
                  {pin.description && (
                    <span className="text-[12px] leading-snug" style={{ color: '#5B6168' }}>
                      Near {pin.areaName}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-[14px] font-semibold text-ink">Select area or pin on map</span>
              )}
            </span>
            <span className="text-[13px] text-brand font-semibold">Change</span>
          </button>

          {quote?.too_far && (
            <div className="px-3 py-2.5 rounded-xl bg-danger/5 border border-danger/20 text-[13px] text-danger leading-relaxed">
              This spot is too far from {quote.vendor_name} for delivery.
            </div>
          )}

          {isGatePickup && (
            <div className="px-3 py-2.5 rounded-xl bg-brand-tint border border-brand/20 text-[13px] text-brand-ink leading-relaxed">
              Your rider will wait at <span className="font-semibold">{selectedArea?.name}</span>. Please come out to collect.
            </div>
          )}

          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
            {isGatePickup ? 'Landmark (optional)' : 'Landmark (required)'}
            <input type="text" value={landmark} onChange={e => setLandmark(e.target.value)}
              placeholder={isGatePickup ? 'e.g. beside pharmacy kiosk' : 'e.g. brown gate, beside pharmacy'}
              className="h-btn-sm px-3 rounded-xl border border-line font-body text-[15px] text-ink" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
            Additional details (optional)
            <input type="text" value={details} onChange={e => setDetails(e.target.value)}
              placeholder="Floor, gate, colour of house..."
              className="h-btn-sm px-3 rounded-xl border border-line font-body text-[15px] text-ink" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
            Phone for the rider to call
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="0803 000 0000"
              className="h-btn-sm px-3 rounded-xl border border-line font-body text-[15px] text-ink" />
          </label>
        </section>

        {/* Fee summary */}
        <section className="bg-white rounded-2xl p-4 flex flex-col gap-2">
          <h2 className="text-[15px] font-bold mb-1">Summary</h2>
          <div className="flex justify-between text-sm">
            <span className="text-ink-2">Items</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-2">
              Delivery
              {quote && !quote.too_far ? ` · ${formatDistance(quote.distance_m)}` : ''}
            </span>
            <span>
              {quoteLoading ? (
                <span className="inline-block w-3 h-3 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
              ) : quote && !quote.too_far ? (
                formatMoney(deliveryFee)
              ) : pin ? '—' : '—'}
            </span>
          </div>
          <div className="flex justify-between text-sm items-center">
            <button type="button" onClick={() => setFeeInfoOpen(p => !p)}
              className="flex items-center gap-1 text-ink-2 bg-transparent border-0 cursor-pointer p-0">
              Service fee
              <Info size={13} strokeWidth={2} className="text-ink-2/60" />
            </button>
            <span>{serviceFee > 0 ? formatMoney(serviceFee) : '—'}</span>
          </div>
          {feeInfoOpen && (
            <p className="text-[12px] text-ink-2 bg-surface rounded-xl px-3 py-2 leading-relaxed">
              Helps us run GoCart: payments, support and refunds.
            </p>
          )}
          <div className="h-px bg-line my-1" />
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
          </div>
        </section>
      </div>

      <div className="mt-auto px-4 pt-3 pb-5 bg-white border-t border-line flex flex-col gap-2.5">
        <div className="flex gap-2 items-start">
          <Lock size={16} stroke="#0B7A47" strokeWidth={2} className="flex-none mt-0.5" />
          <span className="text-xs leading-snug text-ink-2">
            Card, transfer or USSD. The kitchen starts cooking only after your payment is confirmed; if they can&apos;t take the order, you&apos;re refunded to your GoCart wallet.
          </span>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button
          onClick={placeOrder}
          loading={loading}
          disabled={!pin || quote?.too_far === true}
          fullWidth
          size="lg"
        >
          Pay {formatMoney(total)}
        </Button>
        <p className="text-[12px] text-ink-2 text-center leading-relaxed">
          By paying you agree to the{' '}
          <Link href="/terms" className="text-brand underline-offset-2 hover:underline">Terms of Use</Link>
          {' '}and{' '}
          <Link href="/refunds" className="text-brand underline-offset-2 hover:underline">Refund Policy</Link>
        </p>
      </div>

      {pickerOpen && (
        <AreaPicker
          areas={areas}
          zones={zones}
          selectedId={pin?.areaId ?? ''}
          onSave={savePin}
          onClose={() => setPickerOpen(false)}
          userId={userId}
        />
      )}
    </div>
  )
}
