'use client'

import { useState } from 'react'
import { formatMoney } from '@/lib/format'
import { calcServiceFee, type ServiceFeeSettings } from '@/lib/serviceFee'

const PREVIEW_AMOUNTS = [150000, 350000, 700000, 2000000] // kobo

interface Props {
  initialSettings: ServiceFeeSettings
}

export function FeesClient({ initialSettings }: Props) {
  const [s, setS] = useState(initialSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof ServiceFeeSettings>(key: K, value: ServiceFeeSettings[K]) {
    setS(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/fees', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_fee_enabled: String(s.enabled),
        service_fee_type: s.type,
        service_fee_percent: String(s.percent),
        service_fee_min: String(s.min),
        service_fee_max: String(s.max),
        service_fee_flat: String(s.flat),
      }),
    })
    setSaving(false)
    if (res.ok) { setSaved(true) } else {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? 'Could not save')
    }
  }

  return (
    <div className="max-w-xl flex flex-col gap-6">
      <h1 className="font-heading font-bold text-[22px]">Fees</h1>

      <div className="bg-white rounded-2xl p-5 flex flex-col gap-5">
        <div>
          <h2 className="font-bold text-[15px]">Service fee</h2>
          <p className="text-[13px] text-ink-2 mt-0.5">
            Charged to the customer on every order. Covers payments, support and refunds.
          </p>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-semibold">Enabled</span>
          <button
            type="button"
            role="switch"
            aria-checked={s.enabled}
            onClick={() => set('enabled', !s.enabled)}
            className={`relative w-12 h-6 rounded-full border-0 cursor-pointer transition-colors ${s.enabled ? 'bg-brand' : 'bg-[#C3C8CD]'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${s.enabled ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>

        {s.enabled && (
          <>
            {/* Type selector */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-ink-2 uppercase tracking-wide">Type</span>
              <div className="flex gap-2">
                {(['percent', 'flat'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('type', t)}
                    className={`h-9 px-4 rounded-lg text-[13px] font-semibold border-0 cursor-pointer transition-colors ${
                      s.type === t ? 'bg-ink text-white' : 'bg-surface text-ink hover:bg-line'
                    }`}
                  >
                    {t === 'percent' ? '% of order' : 'Flat amount'}
                  </button>
                ))}
              </div>
            </div>

            {s.type === 'percent' ? (
              <div className="flex flex-col gap-3">
                {/* Percent */}
                <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
                  Percentage
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="1" max="20" step="1"
                      value={s.percent}
                      onChange={e => set('percent', parseInt(e.target.value || '5', 10))}
                      className="w-24 h-10 px-3 rounded-xl border border-line font-body text-[15px] text-ink text-right"
                    />
                    <span className="text-[14px] text-ink-2">%</span>
                  </div>
                </label>

                {/* Min */}
                <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
                  Minimum fee
                  <div className="flex items-center gap-2">
                    <span className="text-ink-2 text-[14px]">₦</span>
                    <input
                      type="number" min="0" step="50"
                      value={s.min / 100}
                      onChange={e => set('min', Math.round(parseFloat(e.target.value || '0') * 100))}
                      className="w-28 h-10 px-3 rounded-xl border border-line font-body text-[15px] text-ink"
                    />
                  </div>
                </label>

                {/* Max */}
                <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
                  Maximum fee
                  <div className="flex items-center gap-2">
                    <span className="text-ink-2 text-[14px]">₦</span>
                    <input
                      type="number" min="0" step="50"
                      value={s.max / 100}
                      onChange={e => set('max', Math.round(parseFloat(e.target.value || '0') * 100))}
                      className="w-28 h-10 px-3 rounded-xl border border-line font-body text-[15px] text-ink"
                    />
                  </div>
                </label>
              </div>
            ) : (
              /* Flat amount */
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
                Flat fee
                <div className="flex items-center gap-2">
                  <span className="text-ink-2 text-[14px]">₦</span>
                  <input
                    type="number" min="0" step="50"
                    value={s.flat / 100}
                    onChange={e => set('flat', Math.round(parseFloat(e.target.value || '0') * 100))}
                    className="w-28 h-10 px-3 rounded-xl border border-line font-body text-[15px] text-ink"
                  />
                </div>
              </label>
            )}
          </>
        )}

        {error && <p className="text-[13px] text-danger">{error}</p>}

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="h-10 px-5 rounded-xl bg-brand text-white text-[13px] font-bold border-0 cursor-pointer disabled:opacity-50 self-start"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>

      {/* Live preview */}
      <div className="bg-white rounded-2xl p-5 flex flex-col gap-3">
        <div>
          <h2 className="font-bold text-[15px]">Live preview</h2>
          <p className="text-[13px] text-ink-2 mt-0.5">
            {s.enabled
              ? s.type === 'percent'
                ? `${s.percent}% of items, min ${formatMoney(s.min)}, max ${formatMoney(s.max)}, rounded to the nearest ₦10`
                : `Flat ${formatMoney(s.flat)} on every order`
              : 'Service fee is disabled — customers are not charged.'}
          </p>
        </div>

        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left pb-2 font-semibold text-[11px] text-ink-2 uppercase tracking-wide">Item total</th>
              <th className="text-right pb-2 font-semibold text-[11px] text-ink-2 uppercase tracking-wide">Service fee</th>
            </tr>
          </thead>
          <tbody>
            {PREVIEW_AMOUNTS.map(amt => {
              const fee = calcServiceFee(amt, s)
              return (
                <tr key={amt} className="border-b border-line last:border-0">
                  <td className="py-2.5 text-ink">{formatMoney(amt)}</td>
                  <td className="py-2.5 text-right font-semibold text-brand">{formatMoney(fee)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
