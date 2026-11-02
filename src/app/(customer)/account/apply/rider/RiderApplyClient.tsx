'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { validatePhone, normalizePhone } from '@/lib/phone'

interface Area { id: string; name: string; district: string | null }

interface Props {
  areas: Area[]
  userId: string
}

export function RiderApplyClient({ areas, userId }: Props) {
  const [areaId, setAreaId] = useState('')
  const [rawPhone, setRawPhone] = useState('')
  const [ownBike, setOwnBike] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function submit() {
    setError('')
    if (!areaId) { setError('Select your area'); return }
    const fullRaw = '0' + rawPhone.replace(/\D/g, '')
    if (!validatePhone(fullRaw)) { setError('Enter a valid Nigerian mobile number'); return }

    setSaving(true)
    const phone = normalizePhone(fullRaw)!
    const res = await fetch('/api/applications/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'rider',
        data: { area_id: areaId, phone, own_bike: ownBike },
      }),
    })
    setSaving(false)
    if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Something went wrong'); return }
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-dvh bg-canvas flex flex-col items-center justify-center px-5 gap-5 text-center font-body">
        <div className="w-16 h-16 rounded-full bg-brand-tint flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0B7A47" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h2 className="font-heading font-extrabold text-[22px] text-ink">Application submitted!</h2>
        <p className="text-[14px] text-ink-2 max-w-xs">
          We&apos;ll call you within 48 hours to complete onboarding. Track the status in your account.
        </p>
        <Button onClick={() => router.push('/account')} fullWidth size="lg">Back to account</Button>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-canvas font-body text-ink"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
      <header className="bg-white px-4 pt-5 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-surface flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-heading font-bold text-[18px]">Ride with GoCart</h1>
      </header>

      <div className="px-4 pt-4 flex flex-col gap-4">
        <p className="text-[14px] text-ink-2">
          Earn by delivering orders in Sagamu. You need your own motorcycle and a phone that can run this app.
        </p>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-ink-2">Your area in Sagamu</span>
          <select value={areaId} onChange={e => setAreaId(e.target.value)}
            className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink bg-white w-full">
            <option value="">Select area…</option>
            {areas.map(a => (
              <option key={a.id} value={a.id}>{a.district ? `${a.district} — ${a.name}` : a.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-ink-2">Contact phone</span>
          <div className="flex h-11 rounded-xl border border-line bg-white overflow-hidden">
            <div className="flex items-center px-3 border-r border-line bg-surface shrink-0">
              <span className="text-[13px] font-semibold text-ink-2">NG +234</span>
            </div>
            <input type="tel" inputMode="tel" value={rawPhone}
              onChange={e => setRawPhone(e.target.value)}
              placeholder="8012345678"
              className="flex-1 px-3 font-body text-[14px] text-ink bg-transparent focus:outline-none" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOwnBike(!ownBike)}
          className={`flex items-center gap-3 h-12 px-4 rounded-xl border-2 text-[14px] font-semibold transition-colors ${
            ownBike ? 'border-brand bg-brand-tint text-brand-ink' : 'border-line text-ink'
          }`}
        >
          <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
            ownBike ? 'bg-brand border-brand' : 'border-line'
          }`}>
            {ownBike && <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
          </div>
          I have my own motorcycle
        </button>

        {error && <p className="text-[13px] text-danger">{error}</p>}

        <Button onClick={submit} loading={saving} fullWidth size="lg">Submit application</Button>
      </div>
    </div>
  )
}
