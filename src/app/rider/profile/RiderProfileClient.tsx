'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { normalisePhone } from '@/lib/format'
import { Toast } from '@/components/ui/Toast'
import { BankAccountForm, type BankAccountValues } from '@/components/ui/BankAccountForm'
import { RiderBottomNav } from '@/components/rider/RiderBottomNav'

interface Props {
  userId: string
  fullName: string
  phone: string
  bikePlate: string | null
  payoutBankCode: string
  payoutBank: string
  payoutAccountName: string
  payoutAccountNo: string
}

export function RiderProfileClient({
  userId, fullName: initName, phone: initPhone, bikePlate,
  payoutBankCode, payoutBank, payoutAccountName, payoutAccountNo,
}: Props) {
  const supabase = createClient()

  const [name, setName] = useState(initName)
  const [phone, setPhone] = useState(initPhone)
  const [savingProfile, setSavingProfile] = useState(false)

  const [payoutData, setPayoutData] = useState<BankAccountValues>({
    bankCode:    payoutBankCode,
    bankName:    payoutBank,
    accountNo:   payoutAccountNo,
    accountName: payoutAccountName,
  })
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

  async function savePayout() {
    if (!payoutData.bankName || !payoutData.accountNo || !payoutData.accountName) {
      setToast('Fill in all payout fields')
      return
    }
    setSavingPayout(true)
    const res = await fetch('/api/rider/payout-account', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bank:         payoutData.bankName,
        bank_code:    payoutData.bankCode,
        account_no:   payoutData.accountNo,
        account_name: payoutData.accountName,
      }),
    })
    const json = await res.json().catch(() => ({}))
    setSavingPayout(false)
    if (res.ok) setToast('Payout account saved')
    else setToast((json as { error?: string }).error || 'Could not save. Try again.')
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
          <p className="text-[12px] text-ink-2 -mt-1">Withdraw earnings to this account.</p>
          <BankAccountForm
            defaultBankCode={payoutBankCode}
            defaultBankName={payoutBank}
            defaultAccountNo={payoutAccountNo}
            defaultAccountName={payoutAccountName}
            onChange={setPayoutData}
          />
          <button
            type="button"
            onClick={savePayout}
            disabled={savingPayout || !payoutData.bankName || !payoutData.accountNo || !payoutData.accountName}
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
