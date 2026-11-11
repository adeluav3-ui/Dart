'use client'

import { useState, useRef, lazy, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { VendorNav } from '@/components/vendor/VendorNav'
import { BankAccountForm, type BankAccountValues } from '@/components/ui/BankAccountForm'
import type { Vendor, VendorHours, Area } from '@/types/database'

const MapPicker = lazy(() => import('@/components/MapPicker').then(m => ({ default: m.MapPicker })))

interface Props {
  vendor: Vendor
  initialHours: VendorHours[]
  areas: Area[]
  hasPushSub: boolean
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1600
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
        else { width = Math.round((width * MAX) / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('fail')), 'image/webp', 0.82)
    }
    img.onerror = reject
    img.src = url
  })
}

export function ShopClient({ vendor, initialHours, areas, hasPushSub }: Props) {
  const supabase = createClient()
  const coverInputRef = useRef<HTMLInputElement>(null)

  // Details
  const [name, setName] = useState(vendor.name)
  const [areaId, setAreaId] = useState(vendor.area_id ?? '')
  const [savingDetails, setSavingDetails] = useState(false)
  const [detailsSaved, setDetailsSaved] = useState(false)

  // Cover photo
  const [coverUrl, setCoverUrl] = useState(vendor.cover_photo_url)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null)
  const [savingCover, setSavingCover] = useState(false)

  // Hours
  const [hours, setHours] = useState(initialHours)
  const [savingHours, setSavingHours] = useState(false)
  const [hoursSaved, setHoursSaved] = useState(false)

  // Payout
  const [payoutData, setPayoutData] = useState<BankAccountValues>({
    bankCode:    vendor.payout_bank_code ?? '',
    bankName:    vendor.payout_bank ?? '',
    accountNo:   vendor.payout_account_no ?? '',
    accountName: vendor.payout_account_name ?? '',
  })
  const [savingPayout, setSavingPayout] = useState(false)
  const [payoutSaved, setPayoutSaved] = useState(false)
  const [payoutError, setPayoutError] = useState('')

  // Push
  const [pushEnabled, setPushEnabled] = useState(hasPushSub)
  const [enablingPush, setEnablingPush] = useState(false)

  // Shop location pin
  const [vendorLat, setVendorLat] = useState(vendor.lat)
  const [vendorLng, setVendorLng] = useState(vendor.lng)
  const [locationLabel, setLocationLabel] = useState<string | null>(null)
  const [showLocationMap, setShowLocationMap] = useState(false)
  const [savingLocation, setSavingLocation] = useState(false)
  const [locationSaved, setLocationSaved] = useState(false)

  async function saveDetails() {
    setSavingDetails(true)
    await supabase
      .from('vendors')
      .update({ name: name.trim(), area_id: areaId || null })
      .eq('id', vendor.id)
    setSavingDetails(false)
    setDetailsSaved(true)
    setTimeout(() => setDetailsSaved(false), 2000)
  }

  async function pickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const blob = await compressImage(file)
    setCoverBlob(blob)
    setCoverPreview(URL.createObjectURL(blob))
  }

  async function saveCover() {
    if (!coverBlob) return
    setSavingCover(true)
    const path = `covers/${vendor.id}.webp`
    await supabase.storage
      .from('vendor-photos')
      .upload(path, coverBlob, { contentType: 'image/webp', upsert: true })
    const { data: { publicUrl } } = supabase.storage.from('vendor-photos').getPublicUrl(path)
    await supabase.from('vendors').update({ cover_photo_url: publicUrl }).eq('id', vendor.id)
    setCoverUrl(publicUrl)
    setCoverPreview(null)
    setCoverBlob(null)
    setSavingCover(false)
  }

  async function saveHours() {
    setSavingHours(true)
    // Delete all existing hours then re-insert
    await supabase.from('vendor_hours').delete().eq('vendor_id', vendor.id)
    for (const h of hours) {
      await supabase.from('vendor_hours').insert({
        vendor_id: vendor.id,
        day_of_week: h.day_of_week,
        opens_at: h.opens_at,
        closes_at: h.closes_at,
      })
    }
    setSavingHours(false)
    setHoursSaved(true)
    setTimeout(() => setHoursSaved(false), 2000)
  }

  function toggleDay(day: number) {
    const existing = hours.find(h => h.day_of_week === day)
    if (existing) {
      setHours(prev => prev.filter(h => h.day_of_week !== day))
    } else {
      setHours(prev => [...prev, {
        id: crypto.randomUUID(),
        vendor_id: vendor.id,
        day_of_week: day,
        opens_at: '08:00',
        closes_at: '21:00',
      }])
    }
  }

  function updateHour(day: number, field: 'opens_at' | 'closes_at', value: string) {
    setHours(prev => prev.map(h => h.day_of_week === day ? { ...h, [field]: value } : h))
  }

  async function savePayout() {
    if (!payoutData.bankName || !payoutData.accountNo || !payoutData.accountName) {
      setPayoutError('Fill in all payout fields')
      return
    }
    setSavingPayout(true)
    setPayoutError('')
    const { error } = await supabase
      .from('vendors')
      .update({
        payout_bank:         payoutData.bankName || null,
        payout_bank_code:    payoutData.bankCode || null,
        payout_account_name: payoutData.accountName || null,
        payout_account_no:   payoutData.accountNo || null,
      })
      .eq('id', vendor.id)
    setSavingPayout(false)
    if (error) {
      setPayoutError(error.message || 'Could not save. Try again.')
      return
    }
    setPayoutSaved(true)
    setTimeout(() => setPayoutSaved(false), 2000)
  }

  async function enablePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notifications are not supported in this browser.')
      return
    }
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return

    setEnablingPush(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      setPushEnabled(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      if (msg.includes('denied') || msg.includes('permission')) {
        alert('Permission denied. Enable notifications in your browser settings.')
      }
    } finally {
      setEnablingPush(false)
    }
  }

  async function saveLocation(lat: number, lng: number, address: string) {
    setSavingLocation(true)
    await supabase.from('vendors').update({ lat, lng }).eq('id', vendor.id)
    setVendorLat(lat)
    setVendorLng(lng)
    setLocationLabel(address || null)
    setSavingLocation(false)
    setLocationSaved(true)
    setShowLocationMap(false)
    setTimeout(() => setLocationSaved(false), 2000)
  }

  const coverSrc = coverPreview ?? coverUrl

  if (showLocationMap) {
    return (
      <Suspense fallback={null}>
        <MapPicker
          initialLat={vendorLat ?? undefined}
          initialLng={vendorLng ?? undefined}
          onConfirm={saveLocation}
          onClose={() => setShowLocationMap(false)}
        />
      </Suspense>
    )
  }

  return (
    <div className="min-h-screen bg-canvas font-body text-ink pb-28">
      <header className="bg-white px-5 pt-5 pb-3 border-b border-line">
        <h1 className="font-heading font-extrabold text-xl">Shop settings</h1>
      </header>

      <div className="px-4 py-4 flex flex-col gap-6">

        {/* Cover photo */}
        <section className="bg-white rounded-2xl p-4 flex flex-col gap-3">
          <h2 className="font-bold text-base">Cover photo</h2>
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            className="w-full h-40 rounded-xl bg-photo overflow-hidden flex items-center justify-center border-2 border-dashed border-[#C9B99A]"
          >
            {coverSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverSrc} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B8A98C" strokeWidth="1.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span className="text-sm text-[#B8A98C] font-medium">Tap to add photo</span>
              </div>
            )}
          </button>
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={pickCover} />
          {coverBlob && (
            <button
              type="button"
              disabled={savingCover}
              onClick={saveCover}
              className="w-full h-10 rounded-xl bg-brand text-white font-bold text-sm border-0 disabled:opacity-50"
            >
              {savingCover ? 'Uploading…' : 'Save cover photo'}
            </button>
          )}
          {!coverBlob && coverUrl && (
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="text-sm font-semibold text-brand text-center"
            >
              Change photo
            </button>
          )}
        </section>

        {/* Shop details */}
        <section className="bg-white rounded-2xl p-4 flex flex-col gap-4">
          <h2 className="font-bold text-base">Shop details</h2>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-ink-2">Shop name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-11 px-4 rounded-xl border border-line text-sm font-body"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-ink-2">Pickup area</label>
            <select
              value={areaId}
              onChange={e => setAreaId(e.target.value)}
              className="h-11 px-4 rounded-xl border border-line text-sm font-body"
            >
              <option value="">Select area…</option>
              {areas.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            disabled={savingDetails || !name.trim()}
            onClick={saveDetails}
            className="h-10 rounded-xl bg-brand text-white font-bold text-sm border-0 disabled:opacity-50"
          >
            {detailsSaved ? 'Saved ✓' : savingDetails ? 'Saving…' : 'Save details'}
          </button>
        </section>

        {/* Opening hours */}
        <section className="bg-white rounded-2xl p-4 flex flex-col gap-4">
          <h2 className="font-bold text-base">Opening hours</h2>

          {DAYS.map((day, dayIdx) => {
            const h = hours.find(x => x.day_of_week === dayIdx)
            const open = !!h
            return (
              <div key={dayIdx} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{day}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={open}
                    onClick={() => toggleDay(dayIdx)}
                    className={`relative w-11 h-6 rounded-full border-0 cursor-pointer transition-colors ${open ? 'bg-brand' : 'bg-[#C3C8CD]'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${open ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
                {open && h && (
                  <div className="grid grid-cols-2 gap-2 ml-0">
                    <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
                      Opens
                      <input
                        type="time"
                        value={h.opens_at}
                        onChange={e => updateHour(dayIdx, 'opens_at', e.target.value)}
                        className="h-9 px-3 rounded-xl border border-line text-sm font-body"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
                      Closes
                      <input
                        type="time"
                        value={h.closes_at}
                        onChange={e => updateHour(dayIdx, 'closes_at', e.target.value)}
                        className="h-9 px-3 rounded-xl border border-line text-sm font-body"
                      />
                    </label>
                  </div>
                )}
              </div>
            )
          })}

          <button
            type="button"
            disabled={savingHours}
            onClick={saveHours}
            className="h-10 rounded-xl bg-brand text-white font-bold text-sm border-0 disabled:opacity-50"
          >
            {hoursSaved ? 'Saved ✓' : savingHours ? 'Saving…' : 'Save hours'}
          </button>
        </section>

        {/* Payout account */}
        <section className="bg-white rounded-2xl p-4 flex flex-col gap-4">
          <h2 className="font-bold text-base">Payout account</h2>
          <p className="text-xs text-ink-2 -mt-2">
            Withdraw earnings to this account.
          </p>

          <BankAccountForm
            defaultBankCode={payoutData.bankCode}
            defaultBankName={payoutData.bankName}
            defaultAccountNo={payoutData.accountNo}
            defaultAccountName={payoutData.accountName}
            onChange={setPayoutData}
          />

          {payoutError && <p className="text-sm text-danger">{payoutError}</p>}

          <button
            type="button"
            disabled={savingPayout || !payoutData.bankName || !payoutData.accountNo || !payoutData.accountName}
            onClick={savePayout}
            className="h-10 rounded-xl bg-brand text-white font-bold text-sm border-0 disabled:opacity-50"
          >
            {payoutSaved ? 'Saved ✓' : savingPayout ? 'Saving…' : 'Save account'}
          </button>
        </section>

        {/* Order alerts */}
        <section className="bg-white rounded-2xl p-4 flex flex-col gap-3">
          <h2 className="font-bold text-base">Order alerts</h2>
          <p className="text-sm text-ink-2">
            Get a push notification the moment a customer places an order.
          </p>

          {pushEnabled ? (
            <div className="flex items-center gap-3 py-2">
              <div className="w-8 h-8 rounded-full bg-brand-tint flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0A4F30" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <span className="text-sm font-semibold text-brand-ink">Alerts enabled on this device</span>
            </div>
          ) : (
            <button
              type="button"
              disabled={enablingPush}
              onClick={enablePush}
              className="h-10 rounded-xl bg-brand text-white font-bold text-sm border-0 disabled:opacity-50"
            >
              {enablingPush ? 'Enabling…' : 'Enable order alerts'}
            </button>
          )}
        </section>

        {/* Shop location */}
        <section className="bg-white rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-bold text-base">Shop location</h2>
              <p className="text-xs text-ink-2 mt-0.5">
                Used to calculate delivery distance and fees. Required to accept orders.
              </p>
            </div>
            {vendorLat != null && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-tint text-brand-ink shrink-0">Set</span>
            )}
          </div>
          {vendorLat != null ? (
            <p className="text-[13px] text-ink-2">
              {locationLabel || `${vendorLat.toFixed(5)}, ${vendorLng?.toFixed(5)}`}
            </p>
          ) : (
            <p className="text-[13px] text-danger font-medium">
              Pin not set — customers cannot place orders until you set it.
            </p>
          )}
          <button
            type="button"
            disabled={savingLocation}
            onClick={() => setShowLocationMap(true)}
            className="h-10 rounded-xl border border-brand bg-brand-tint text-brand font-bold text-sm border-0 disabled:opacity-50"
          >
            {locationSaved ? 'Location saved ✓' : savingLocation ? 'Saving…' : vendorLat != null ? 'Update location' : 'Set shop location'}
          </button>
        </section>

        {/* Switch to customer app */}
        <section className="bg-white rounded-2xl p-4 flex flex-col gap-3">
          <h2 className="font-bold text-base">Switch mode</h2>
          <p className="text-[13px] text-ink-2">You can order as a customer while keeping your vendor account.</p>
          <a
            href="/home"
            className="h-10 rounded-xl border border-line bg-white text-sm font-bold text-ink flex items-center justify-center no-underline"
          >
            Go to customer app
          </a>
        </section>

      </div>

      <VendorNav />
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const arr = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i)
  return arr.buffer
}
