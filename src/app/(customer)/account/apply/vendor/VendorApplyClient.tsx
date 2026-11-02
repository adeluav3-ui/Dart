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

export function VendorApplyClient({ areas, userId }: Props) {
  const [bizName, setBizName] = useState('')
  const [storeType, setStoreType] = useState<'restaurant' | 'supermarket' | 'pharmacy'>('restaurant')
  const [areaId, setAreaId] = useState('')
  const [landmark, setLandmark] = useState('')
  const [rawPhone, setRawPhone] = useState('')
  const [pcnLicence, setPcnLicence] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function submit() {
    setError('')
    if (!bizName.trim()) { setError('Enter your business name'); return }
    if (!areaId) { setError('Select your area'); return }
    if (!landmark.trim()) { setError('Enter a landmark'); return }
    const fullRaw = '0' + rawPhone.replace(/\D/g, '')
    if (!validatePhone(fullRaw)) { setError('Enter a valid Nigerian mobile number'); return }
    if (storeType === 'pharmacy' && !pcnLicence.trim()) { setError('Enter your PCN licence number'); return }

    setSaving(true)
    const phone = normalizePhone(fullRaw)!
    const res = await fetch('/api/applications/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'vendor',
        data: {
          business_name: bizName.trim(),
          store_type: storeType,
          area_id: areaId,
          landmark: landmark.trim(),
          phone,
          ...(storeType === 'pharmacy' ? { pcn_licence: pcnLicence.trim() } : {}),
        },
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
          We&apos;ll review your application and call you within 48 hours. You can track the status in your account.
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
        <h1 className="font-heading font-bold text-[18px]">Sell on GoCart</h1>
      </header>

      <div className="px-4 pt-4 flex flex-col gap-4">
        <Field label="Business name">
          <input type="text" value={bizName} onChange={e => setBizName(e.target.value)}
            placeholder="e.g. Mama Tolu's Kitchen"
            className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink w-full" />
        </Field>

        <Field label="Store type">
          <select value={storeType} onChange={e => setStoreType(e.target.value as typeof storeType)}
            className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink bg-white w-full">
            <option value="restaurant">Restaurant / Kitchen</option>
            <option value="supermarket">Supermarket / Grocery</option>
            <option value="pharmacy">Pharmacy</option>
          </select>
        </Field>

        <Field label="Area in Sagamu">
          <select value={areaId} onChange={e => setAreaId(e.target.value)}
            className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink bg-white w-full">
            <option value="">Select area…</option>
            {areas.map(a => (
              <option key={a.id} value={a.id}>{a.district ? `${a.district} — ${a.name}` : a.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Nearest landmark">
          <input type="text" value={landmark} onChange={e => setLandmark(e.target.value)}
            placeholder="e.g. Beside NNPC filling station"
            className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink w-full" />
        </Field>

        <Field label="Contact phone">
          <div className="flex h-11 rounded-xl border border-line bg-white overflow-hidden">
            <div className="flex items-center px-3 border-r border-line bg-surface shrink-0">
              <span className="text-[13px] font-semibold text-ink-2">NG +234</span>
            </div>
            <input type="tel" inputMode="tel" value={rawPhone}
              onChange={e => setRawPhone(e.target.value)}
              placeholder="8012345678"
              className="flex-1 px-3 font-body text-[14px] text-ink bg-transparent focus:outline-none" />
          </div>
        </Field>

        {storeType === 'pharmacy' && (
          <Field label="PCN Licence number">
            <input type="text" value={pcnLicence} onChange={e => setPcnLicence(e.target.value)}
              placeholder="e.g. PCN/2023/001234"
              className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink w-full" />
          </Field>
        )}

        {error && <p className="text-[13px] text-danger">{error}</p>}

        <Button onClick={submit} loading={saving} fullWidth size="lg">Submit application</Button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-ink-2">{label}</span>
      {children}
    </div>
  )
}
