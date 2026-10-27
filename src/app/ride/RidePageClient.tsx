'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { validatePhone } from '@/lib/phone'

interface Area { id: string; name: string; district: string | null }

const LS_KEY = 'dart_ride_draft'

export function RidePageClient({ areas }: { areas: Area[] }) {
  const [areaId, setAreaId] = useState('')
  const [rawPhone, setRawPhone] = useState('')
  const [ownBike, setOwnBike] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) {
        const d = JSON.parse(saved)
        setAreaId(d.areaId ?? '')
        setRawPhone(d.rawPhone ?? '')
        setOwnBike(d.ownBike ?? false)
      }
    } catch { /* ignore */ }
  }, [])

  function handleContinue() {
    setError('')
    if (!areaId) { setError('Select your area'); return }
    const fullRaw = '0' + rawPhone.replace(/\D/g, '')
    if (!validatePhone(fullRaw)) { setError('Enter a valid Nigerian mobile number'); return }

    try { localStorage.setItem(LS_KEY, JSON.stringify({ areaId, rawPhone, ownBike })) } catch { /* ignore */ }
    router.push('/login?next=/account/apply/rider')
  }

  return (
    <div className="min-h-dvh bg-canvas font-body text-ink"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
      <header className="bg-white px-4 pt-5 pb-4 flex items-center gap-3">
        <Link href="/" className="w-9 h-9 rounded-full bg-surface flex items-center justify-center">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-heading font-bold text-[18px]">Ride with Dart</h1>
      </header>

      <div className="px-4 pt-4 flex flex-col gap-4">
        <p className="text-[14px] text-ink-2">
          Earn by delivering orders in Sagamu. You need your own motorcycle.
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

        <Button onClick={handleContinue} fullWidth size="lg">Continue to sign in</Button>

        <p className="text-center text-[12px] text-ink-2">
          Already have an account?{' '}
          <Link href="/login?next=/account/apply/rider" className="text-brand font-semibold">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
