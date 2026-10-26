'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/format'
import { useCart, cartSubtotal } from '@/store/cart'
import { Button } from '@/components/ui/Button'
import type { Zone, ZoneFare } from '@/types/database'

export default function CheckoutPage() {
  const { cart, clearCart } = useCart()
  const router = useRouter()
  const supabase = createClient()

  const [zones, setZones] = useState<Zone[]>([])
  const [fares, setFares] = useState<ZoneFare[]>([])
  const [customerZoneId, setCustomerZoneId] = useState('')
  const [landmark, setLandmark] = useState('')
  const [details, setDetails] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState<{ id: string } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user)
    })
    supabase
      .from('zones')
      .select('id, name, is_active')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (data) {
          setZones(data as Zone[])
          if (data.length > 0) setCustomerZoneId(data[0].id)
        }
      })
    supabase
      .from('zone_fares')
      .select('*')
      .then(({ data }) => { if (data) setFares(data as ZoneFare[]) })
  }, [])

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-ink-2">Your cart is empty</p>
        <Link href="/" className="text-brand font-semibold underline">Back to home</Link>
      </div>
    )
  }

  const subtotal = cartSubtotal(cart)

  // Delivery fee from zone_fares (vendor zone → customer zone)
  // vendorZoneId comes from the vendor; if no fare row exists, delivery_fee = 0
  const vendorZoneId = (cart as { vendorZoneId?: string }).vendorZoneId ?? null
  const fare = fares.find(f =>
    f.from_zone === vendorZoneId && f.to_zone === customerZoneId
  ) ?? fares.find(f => f.to_zone === customerZoneId) ?? null

  const deliveryFee = fare?.delivery_fee ?? 0
  const riderPay = fare?.rider_pay ?? 0
  const serviceFee = 0
  const total = subtotal + deliveryFee + serviceFee
  const selectedZone = zones.find(z => z.id === customerZoneId)

  async function placeOrder() {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent('/checkout')}`)
      return
    }
    if (!customerZoneId) { setError('Select your area'); return }
    if (!landmark.trim()) { setError('Landmark is required'); return }
    if (!phone.trim()) { setError('Enter a phone number for the rider to call'); return }

    setLoading(true)
    setError('')

    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart,
        customerZoneId,
        landmark: landmark.trim(),
        details: details.trim() || null,
        phone: phone.trim(),
      }),
    })

    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(json.error ?? 'Something went wrong')
      return
    }

    if (json.checkoutUrl) {
      clearCart()
      window.location.href = json.checkoutUrl
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col font-body text-ink">
      <header className="flex items-center gap-2 px-4 pt-4 pb-2 bg-canvas">
        <Link href={`/vendor/${cart.vendorId}`} aria-label="Back" className="w-11 h-11 flex items-center justify-center">
          <ArrowLeft size={22} strokeWidth={2.2} />
        </Link>
        <h1 className="font-heading font-extrabold text-2xl">Checkout</h1>
      </header>

      <div className="px-4 flex flex-col gap-3">
        {/* Order summary */}
        <section className="bg-white rounded-2xl p-4">
          <div className="flex justify-between items-baseline">
            <h2 className="text-[15px] font-bold">{cart.vendorName}</h2>
            <Link href={`/vendor/${cart.vendorId}`} className="text-[13px] font-semibold text-brand no-underline">Add items</Link>
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
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
            Area
            <select
              value={customerZoneId}
              onChange={e => setCustomerZoneId(e.target.value)}
              className="h-btn-sm px-3 rounded-xl border border-line bg-white font-body text-[15px] text-ink font-medium"
            >
              {zones.map(z => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
            Landmark (required)
            <input
              type="text"
              value={landmark}
              onChange={e => setLandmark(e.target.value)}
              placeholder="e.g. OOUTH main gate, beside pharmacy"
              className="h-btn-sm px-3 rounded-xl border border-line font-body text-[15px] text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
            Additional details (optional)
            <input
              type="text"
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="Floor, gate, colour of house..."
              className="h-btn-sm px-3 rounded-xl border border-line font-body text-[15px] text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
            Phone for the rider to call
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="0803 000 0000"
              className="h-btn-sm px-3 rounded-xl border border-line font-body text-[15px] text-ink"
            />
          </label>
        </section>

        {/* Fee summary */}
        <section className="bg-white rounded-2xl p-4 flex flex-col gap-2">
          <h2 className="text-[15px] font-bold mb-1">Summary</h2>
          <div className="flex justify-between text-sm"><span className="text-ink-2">Food</span><span>{formatMoney(subtotal)}</span></div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-2">Delivery{selectedZone ? ` · ${selectedZone.name}` : ''}</span>
            <span>{deliveryFee > 0 ? formatMoney(deliveryFee) : '—'}</span>
          </div>
          <div className="flex justify-between text-sm"><span className="text-ink-2">Service fee</span><span>{serviceFee > 0 ? formatMoney(serviceFee) : '—'}</span></div>
          <div className="h-px bg-line my-1" />
          <div className="flex justify-between text-base font-bold"><span>Total</span><span>{formatMoney(total)}</span></div>
        </section>
      </div>

      {/* Pay button */}
      <div className="mt-auto px-4 pt-3 pb-5 bg-white border-t border-line flex flex-col gap-2.5">
        <div className="flex gap-2 items-start">
          <Lock size={16} stroke="#0B7A47" strokeWidth={2} className="flex-none mt-0.5" />
          <span className="text-xs leading-snug text-ink-2">
            Card, transfer or USSD. The kitchen starts cooking only after your payment is confirmed; if they can&apos;t take the order, you&apos;re refunded to your Dart wallet.
          </span>
        </div>
        {!user && (
          <p className="text-xs text-ink-2 text-center">
            You&apos;ll be asked to sign in before paying.
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button onClick={placeOrder} loading={loading} fullWidth size="lg">
          Pay {formatMoney(total)}
        </Button>
      </div>
    </div>
  )
}
