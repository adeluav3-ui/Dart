'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/format'
import { calcDeliveryPrice } from '@/lib/pricing/delivery'
import { calcServiceFee, type ServiceFeeSettings } from '@/lib/serviceFee'
import type { DeliveryPricingSettings } from '@/types/database'

interface Props {
  initialSettings: DeliveryPricingSettings | null
  googleCallsToday: number
  initialFeeSettings: ServiceFeeSettings
}

const DEFAULT: Omit<DeliveryPricingSettings, 'id' | 'updated_at'> = {
  base_fare_kobo: 15000,
  per_km_kobo: 12500,
  min_fare_kobo: 20000,
  round_to_kobo: 5000,
  rider_extra_kobo: 10000,
  gocart_extra_kobo: 10000,
  max_distance_m: 7000,
  daily_google_call_cap: 400,
}

function koboToNaira(kobo: number): string {
  return (kobo / 100).toFixed(0)
}
function nairaToKobo(s: string): number {
  return Math.round(parseFloat(s || '0') * 100)
}
function mToStr(m: number): string {
  return String(m)
}
function strToM(s: string): number {
  return parseInt(s || '0', 10)
}

export function DeliveryPricesClient({ initialSettings, googleCallsToday, initialFeeSettings }: Props) {
  const supabase = createClient()
  const src = initialSettings ?? { id: 1, updated_at: '', ...DEFAULT }

  const [baseFare, setBaseFare] = useState(koboToNaira(src.base_fare_kobo))
  const [perKm, setPerKm] = useState(koboToNaira(src.per_km_kobo))
  const [minFare, setMinFare] = useState(koboToNaira(src.min_fare_kobo))
  const [roundTo, setRoundTo] = useState(koboToNaira(src.round_to_kobo))
  const [gocartExtra, setGocartExtra] = useState(koboToNaira(src.gocart_extra_kobo))
  const [maxDist, setMaxDist] = useState(mToStr(src.max_distance_m))
  const [dailyCap, setDailyCap] = useState(String(src.daily_google_call_cap))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Test distance
  const [testDist, setTestDist] = useState('1400')
  const [testItemTotal, setTestItemTotal] = useState('3500')

  async function saveSettings() {
    setSaving(true)
    setSaveError('')
    const { error } = await supabase.from('delivery_pricing_settings').upsert({
      id: 1,
      base_fare_kobo: nairaToKobo(baseFare),
      per_km_kobo: nairaToKobo(perKm),
      min_fare_kobo: nairaToKobo(minFare),
      round_to_kobo: nairaToKobo(roundTo),
      rider_extra_kobo: 0,
      gocart_extra_kobo: nairaToKobo(gocartExtra),
      max_distance_m: strToM(maxDist),
      daily_google_call_cap: parseInt(dailyCap || '400', 10),
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const currentSettings: DeliveryPricingSettings = {
    id: 1,
    updated_at: '',
    base_fare_kobo: nairaToKobo(baseFare),
    per_km_kobo: nairaToKobo(perKm),
    min_fare_kobo: nairaToKobo(minFare),
    round_to_kobo: nairaToKobo(roundTo),
    rider_extra_kobo: 0,
    gocart_extra_kobo: nairaToKobo(gocartExtra),
    max_distance_m: strToM(maxDist),
    daily_google_call_cap: parseInt(dailyCap || '400', 10),
  }

  const testDistM = parseInt(testDist || '0', 10)
  const testResult = !isNaN(testDistM) && testDistM > 0
    ? calcDeliveryPrice(testDistM, currentSettings)
    : null

  const testSubtotal = nairaToKobo(testItemTotal)
  const testServiceFee = calcServiceFee(testSubtotal, initialFeeSettings)

  return (
    <div className="min-h-screen bg-canvas font-body text-ink pb-16">
      <header className="bg-white px-5 pt-6 pb-4 border-b border-line">
        <h1 className="font-heading font-extrabold text-xl">Delivery Pricing</h1>
        <p className="text-sm text-ink-2 mt-1">Distance-based fare formula for all orders.</p>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">

        {/* Google API status */}
        <section className="bg-white rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Google Routes API</p>
            <p className="text-xs text-ink-2 mt-0.5">
              Google calls today: <span className="font-bold text-ink">{googleCallsToday}</span> of{' '}
              <span className="font-bold text-ink">{currentSettings.daily_google_call_cap}</span>
            </p>
          </div>
          <div className={`w-2.5 h-2.5 rounded-full ${googleCallsToday < currentSettings.daily_google_call_cap ? 'bg-brand' : 'bg-danger'}`} />
        </section>

        {/* Pricing settings */}
        <section className="bg-white rounded-2xl p-4 flex flex-col gap-4">
          <h2 className="font-bold text-base">Fare formula</h2>
          <p className="text-xs text-ink-2 -mt-2">
            market_rate = max(min_fare, ceil((base + per_km × km) / round_to) × round_to)<br />
            customer_fee = market_rate + GoCart margin · rider_pay = market_rate
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Base fare (₦)" value={baseFare} onChange={setBaseFare} />
            <Field label="Per km (₦)" value={perKm} onChange={setPerKm} />
            <Field label="Min fare (₦)" value={minFare} onChange={setMinFare} />
            <Field label="Round to (₦)" value={roundTo} onChange={setRoundTo} />
            <Field label="GoCart margin (₦)" value={gocartExtra} onChange={setGocartExtra} />
            <Field label="Max distance (m)" value={maxDist} onChange={setMaxDist} isMetres />
            <Field label="Daily Google cap" value={dailyCap} onChange={setDailyCap} isMetres />
          </div>

          {saveError && <p className="text-sm text-danger">{saveError}</p>}
          <button
            type="button"
            disabled={saving}
            onClick={saveSettings}
            className="h-10 rounded-xl bg-brand text-white font-bold text-sm border-0 disabled:opacity-50"
          >
            {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save settings'}
          </button>
        </section>

        {/* Test a distance */}
        <section className="bg-white rounded-2xl p-4 flex flex-col gap-4">
          <h2 className="font-bold text-base">Test a distance</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Distance (m)" value={testDist} onChange={setTestDist} isMetres />
            <Field label="Item total (₦)" value={testItemTotal} onChange={setTestItemTotal} />
          </div>

          {testResult && (
            <div className="bg-surface rounded-xl p-4 flex flex-col gap-2 text-sm">
              <Row label="Customer delivery fee" value={formatMoney(testResult.okada_fare)} />
              <Row label="Rider earns" value={formatMoney(testResult.rider_pay)} />
              <Row label="GoCart delivery margin" value={formatMoney(testResult.okada_fare - testResult.rider_pay)} />
              <Row label="Service fee" value={formatMoney(testServiceFee)} />
              <div className="h-px bg-line my-1" />
              <Row label="Customer total" value={formatMoney(testSubtotal + testResult.okada_fare + testServiceFee)} bold />
              <Row label="GoCart total margin" value={formatMoney(testResult.okada_fare - testResult.rider_pay + testServiceFee)} bold />
            </div>
          )}
        </section>

      </div>
    </div>
  )
}

function Field({
  label, value, onChange, isMetres,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  isMetres?: boolean
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
      {label}
      <input
        type="number"
        inputMode={isMetres ? 'numeric' : 'decimal'}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-10 px-3 rounded-xl border border-line font-body text-sm text-ink"
      />
    </label>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold' : ''}`}>
      <span className={bold ? '' : 'text-ink-2'}>{label}</span>
      <span>{value}</span>
    </div>
  )
}
