'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { validatePhone } from '@/lib/phone'

interface Area { id: string; name: string; district: string | null }

const LS_KEY = 'dart_sell_draft'

interface Draft {
  bizName: string
  storeType: string
  areaId: string
  landmark: string
  rawPhone: string
}

export function SellPageClient({ areas }: { areas: Area[] }) {
  const [bizName, setBizName] = useState('')
  const [storeType, setStoreType] = useState('restaurant')
  const [areaId, setAreaId] = useState('')
  const [landmark, setLandmark] = useState('')
  const [rawPhone, setRawPhone] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  // Restore draft from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) {
        const d: Draft = JSON.parse(saved)
        setBizName(d.bizName ?? '')
        setStoreType(d.storeType ?? 'restaurant')
        setAreaId(d.areaId ?? '')
        setLandmark(d.landmark ?? '')
        setRawPhone(d.rawPhone ?? '')
      }
    } catch { /* ignore */ }
  }, [])

  function saveDraft() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ bizName, storeType, areaId, landmark, rawPhone }))
    } catch { /* ignore */ }
  }

  function handleContinue() {
    setError('')
    if (!bizName.trim()) { setError('Enter your business name'); return }
    if (!areaId) { setError('Select your area'); return }
    if (!landmark.trim()) { setError('Enter a landmark'); return }
    const fullRaw = '0' + rawPhone.replace(/\D/g, '')
    if (!validatePhone(fullRaw)) { setError('Enter a valid Nigerian mobile number'); return }

    saveDraft()
    router.push('/account/apply/vendor')
  }

  return (
    <div className="min-h-dvh bg-canvas font-body text-ink"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
      <header className="bg-white px-4 pt-5 pb-4 flex items-center gap-3">
        <Link href="/" className="w-9 h-9 rounded-full bg-surface flex items-center justify-center">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-heading font-bold text-[18px]">Sell on GoCart</h1>
      </header>

      <div className="px-4 pt-4 flex flex-col gap-4">
        <p className="text-[14px] text-ink-2">
          Reach customers in Sagamu. Fill this in — we&apos;ll ask you to sign in at the end.
        </p>

        <Field label="Business name">
          <input type="text" value={bizName} onChange={e => setBizName(e.target.value)}
            placeholder="e.g. Mama Tolu's Kitchen"
            className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink w-full" />
        </Field>

        <Field label="Store type">
          <select value={storeType} onChange={e => setStoreType(e.target.value)}
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

        {error && <p className="text-[13px] text-danger">{error}</p>}

        <Button onClick={handleContinue} fullWidth size="lg">Continue to sign in</Button>

        <p className="text-center text-[12px] text-ink-2">
          Already have an account?{' '}
          <Link href="/account/apply/vendor" className="text-brand font-semibold">Sign in</Link>
        </p>
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
