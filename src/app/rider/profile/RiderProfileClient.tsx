'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { normalisePhone } from '@/lib/format'
import { Toast } from '@/components/ui/Toast'
import { RiderBottomNav } from '@/components/rider/RiderBottomNav'

const NG_BANKS = [
  'Access Bank', 'Fidelity Bank', 'First Bank', 'GTBank', 'Keystone Bank',
  'Opay', 'PalmPay', 'Polaris Bank', 'Stanbic IBTC', 'Sterling Bank',
  'UBA', 'Union Bank', 'VFD Microfinance', 'Wema Bank', 'Zenith Bank',
]

interface Props {
  userId: string
  fullName: string
  phone: string
  bikePlate: string | null
  payoutBank: string
  payoutAccountName: string
  payoutAccountNo: string
}

export function RiderProfileClient({
  userId, fullName: initName, phone: initPhone, bikePlate,
  payoutBank: initBank, payoutAccountName: initAccName, payoutAccountNo: initAccNo,
}: Props) {
  const supabase = createClient()

  const [name, setName] = useState(initName)
  const [phone, setPhone] = useState(initPhone)
  const [savingProfile, setSavingProfile] = useState(false)

  const [bank, setBank] = useState(initBank)
  const [accNo, setAccNo] = useState(initAccNo)
  const [accName, setAccName] = useState(initAccName)
  const [lookingUp, setLookingUp] = useState(false)
  const [savingPayout, setSavingPayout] = useState(false)

  const [toast, setToast] = useState('')

  async function saveProfile() {
    if (!name.trim()) return
    setSavingProfile(true)
    const normalised = normalisePhone(phone.trim())
    await supabase.from('profiles').update({ full_name: name.trim(), phone: normalised }).eq('id', userId)
    setSavingProfile(false)
    setToast('Profile saved')
  }

  async function lookupAccount() {
    if (!bank || accNo.length < 10) return
    setLookingUp(true)
    const res = await fetch(`/api/rider/lookup-account?bank=${encodeURIComponent(bank)}&account=${accNo}`)
    const json = await res.json().catch(() => ({}))
    setLookingUp(false)
    if (json.name) setAccName(json.name)
    else setToast('Could not look up account. Enter name manually.')
  }

  async function savePayout() {
    if (!bank || !accNo || !accName) { setToast('Fill in all payout fields'); return }
    setSavingPayout(true)
    const res = await fetch('/api/rider/payout-account', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bank, account_no: accNo, account_name: accName }),
    })
    setSavingPayout(false)
    if (res.ok) setToast('Payout account saved')
    else setToast('Could not save. Try again.')
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-canvas font-body text-ink"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}>

      <header className="bg-white px-5 pt-5 pb-4 border-b border-line">
        <h1 className="font-heading font-extrabold text-[26px] text-ink">Profile</h1>
      </header>

      <div className="px-4 py-4 flex flex-col gap-4">

        {/* Name + phone */}
        <section className="bg-white rounded-2xl p-4 flex flex-col gap-3">
          <h2 className="text-[14px] font-bold text-ink">Personal info</h2>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
            Full name
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-btn-sm px-3 rounded-xl border border-line font-body text-[15px] text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
            Phone
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="h-btn-sm px-3 rounded-xl border border-line font-body text-[15px] text-ink"
            />
          </label>
          {bikePlate && (
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
              Bike plate
              <input
                type="text"
                value={bikePlate}
                readOnly
                className="h-btn-sm px-3 rounded-xl border border-line font-body text-[15px] text-ink bg-surface"
              />
            </label>
          )}
          <button
            type="button"
            onClick={saveProfile}
            disabled={savingProfile || !name.trim()}
            className="h-btn rounded-2xl bg-brand text-white font-bold text-[15px] disabled:opacity-50"
          >
            {savingProfile ? 'Saving…' : 'Save'}
          </button>
        </section>

        {/* Payout account */}
        <section className="bg-white rounded-2xl p-4 flex flex-col gap-3">
          <h2 className="text-[14px] font-bold text-ink">Payout account</h2>
          <p className="text-[12px] text-ink-2 -mt-1">Earnings are paid here nightly.</p>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
            Bank
            <select
              value={bank}
              onChange={e => setBank(e.target.value)}
              className="h-btn-sm px-3 rounded-xl border border-line font-body text-[15px] text-ink bg-white"
            >
              <option value="">Select bank…</option>
              {NG_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
            Account number
            <div className="flex gap-2">
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={accNo}
                onChange={e => setAccNo(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10 digits"
                className="flex-1 h-btn-sm px-3 rounded-xl border border-line font-body text-[15px] text-ink"
              />
              <button
                type="button"
                onClick={lookupAccount}
                disabled={lookingUp || accNo.length < 10 || !bank}
                className="h-btn-sm px-4 rounded-xl bg-surface border border-line text-[13px] font-bold text-ink-2 shrink-0 disabled:opacity-40"
              >
                {lookingUp ? '…' : 'Verify'}
              </button>
            </div>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
            Account name
            <input
              type="text"
              value={accName}
              onChange={e => setAccName(e.target.value)}
              placeholder="Filled after verification"
              className="h-btn-sm px-3 rounded-xl border border-line font-body text-[15px] text-ink"
            />
          </label>
          <button
            type="button"
            onClick={savePayout}
            disabled={savingPayout || !bank || !accNo || !accName}
            className="h-btn rounded-2xl bg-brand text-white font-bold text-[15px] disabled:opacity-50"
          >
            {savingPayout ? 'Saving…' : 'Save payout account'}
          </button>
        </section>

        {/* Links */}
        <section className="bg-white rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => window.location.href = '/home'}
            className="w-full flex items-center justify-between px-4 py-4 border-b border-line text-left"
          >
            <span className="text-[15px] font-semibold text-ink">Switch to customer app</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B6168" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
          <Link href="/account/help"
            className="flex items-center justify-between px-4 py-4 border-b border-line no-underline">
            <span className="text-[15px] font-semibold text-ink">Help and support</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B6168" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </Link>
          <Link href="/terms"
            className="flex items-center justify-between px-4 py-4 no-underline">
            <span className="text-[15px] font-semibold text-ink">Terms of use</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B6168" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </Link>
        </section>

        <button
          type="button"
          onClick={signOut}
          className="bg-white rounded-2xl h-[52px] w-full font-bold text-[15px] text-danger"
        >
          Sign out
        </button>
      </div>

      {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
      <RiderBottomNav />
    </div>
  )
}
