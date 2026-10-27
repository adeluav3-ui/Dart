'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { X, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney, formatDate } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import type { LedgerEntry, LedgerKind, Order } from '@/types/database'

type LedgerWithOrder = LedgerEntry & {
  orders: (Pick<Order, 'code' | 'vendor_id'> & {
    vendors: { name: string } | null
  }) | null
}

interface Props {
  userId: string
  balance: number
  entries: LedgerWithOrder[]
}

const HISTORY_LABELS: Record<LedgerKind, string> = {
  refund: 'Refund',
  payout: 'Moved to bank',
  adjustment: 'Used at checkout',
  earning: 'Credit',
}

export function WalletClient({ userId, balance, entries }: Props) {
  const [showMoveSheet, setShowMoveSheet] = useState(false)
  const router = useRouter()

  return (
    <div className="min-h-dvh bg-canvas font-body text-ink"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>

      <header className="bg-white px-5 pt-5 pb-4">
        <h1 className="font-heading font-extrabold text-[26px] text-ink">Wallet</h1>
      </header>

      <div className="px-4 pt-4 flex flex-col gap-3">
        {/* Balance card */}
        <div className="bg-brand rounded-2xl p-5 overflow-hidden relative">
          {/* Watermark circle */}
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full border-[20px] border-white/10 pointer-events-none" />
          <p className="text-[13px] font-semibold text-white/80 mb-1">Dart credit</p>
          <p className="font-heading font-extrabold text-[40px] text-white leading-none mb-1">
            {formatMoney(balance)}
          </p>
          <p className="text-[13px] text-white/70 mb-4">Used automatically at your next checkout</p>
          <div className="flex gap-2">
            <Link
              href="/home"
              className="flex-1 h-10 rounded-xl bg-white text-brand-ink font-bold text-[14px] flex items-center justify-center no-underline"
            >
              Spend it
            </Link>
            <button
              type="button"
              onClick={() => setShowMoveSheet(true)}
              disabled={balance <= 0}
              className="flex-1 h-10 rounded-xl border-2 border-white/60 text-white font-bold text-[14px] disabled:opacity-40"
            >
              Move to bank
            </button>
          </div>
        </div>

        {/* Info note */}
        <div className="bg-white rounded-2xl px-4 py-3 flex gap-3 items-start">
          <Info size={16} className="text-ink-2 shrink-0 mt-0.5" />
          <p className="text-[13px] text-ink-2 leading-relaxed">
            Credit comes from refunds, such as an item a shop didn&apos;t have.
            It never expires, and you can move it to your bank any time.
          </p>
        </div>

        {/* History */}
        {entries.length > 0 && (
          <>
            <p className="font-heading font-bold text-[16px] text-ink mt-1">History</p>
            <div className="bg-white rounded-2xl overflow-hidden">
              {entries.map((e, i) => {
                const isCredit = e.kind === 'refund'
                const label = HISTORY_LABELS[e.kind] ?? e.kind
                const vendorName = e.orders?.vendors?.name
                const subtitle = vendorName
                  ? `${vendorName}${e.note ? ` · ${e.note}` : ''}`
                  : e.note ?? e.orders?.code ?? '—'

                return (
                  <div
                    key={e.id}
                    className={`flex items-center gap-3 px-4 py-3.5 ${
                      i < entries.length - 1 ? 'border-b border-line' : ''
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      isCredit ? 'bg-brand-tint' : 'bg-surface'
                    }`}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        {isCredit ? (
                          <path d="M8 12V4M4 8l4 4 4-4" stroke="#0B7A47" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        ) : (
                          <path d="M8 4v8M4 8l4-4 4 4" stroke="#5B6168" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        )}
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-ink truncate">{label}</p>
                      <p className="text-[12px] text-ink-2 truncate">{subtitle} · {formatDate(e.created_at)}</p>
                    </div>
                    <span className={`text-[15px] font-bold shrink-0 ${isCredit ? 'text-brand' : 'text-ink'}`}>
                      {isCredit ? '+' : '−'}{formatMoney(e.amount)}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {entries.length === 0 && (
          <p className="text-[14px] text-ink-2 text-center py-6">No transactions yet.</p>
        )}
      </div>

      {/* Move to bank sheet */}
      {showMoveSheet && (
        <MoveToBank
          userId={userId}
          maxAmount={balance}
          onClose={() => setShowMoveSheet(false)}
          onDone={() => { setShowMoveSheet(false); router.refresh() }}
        />
      )}
    </div>
  )
}

function MoveToBank({
  userId,
  maxAmount,
  onClose,
  onDone,
}: {
  userId: string
  maxAmount: number
  onClose: () => void
  onDone: () => void
}) {
  const [bankName, setBankName] = useState('')
  const [accountNo, setAccountNo] = useState('')
  const [accountName, setAccountName] = useState('')
  const [amount, setAmount] = useState(String(Math.floor(maxAmount / 100)))
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function submit() {
    setError('')
    if (!bankName.trim()) { setError('Select a bank'); return }
    if (accountNo.length < 10) { setError('Enter a valid 10-digit account number'); return }
    if (!accountName.trim()) { setError('Enter the account name'); return }
    const kobo = Math.round(parseFloat(amount) * 100)
    if (!kobo || kobo <= 0 || kobo > maxAmount) { setError('Enter a valid amount'); return }

    setSaving(true)
    const { error: dbErr } = await supabase.from('payout_requests').insert({
      user_id: userId,
      amount: kobo,
      bank_name: bankName.trim(),
      account_no: accountNo.trim(),
      account_name: accountName.trim(),
    })
    setSaving(false)
    if (dbErr) { setError(dbErr.message); return }
    setDone(true)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-3xl max-w-md mx-auto flex flex-col"
        style={{ maxHeight: '88dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
          <span className="font-heading font-bold text-[17px]">Move to bank</span>
          <button type="button" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-surface">
            <X size={16} />
          </button>
        </div>

        {done ? (
          <div className="px-5 pb-8 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-brand-tint flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0B7A47" strokeWidth="2.5" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <p className="font-heading font-bold text-[18px] text-ink">Request submitted</p>
            <p className="text-[14px] text-ink-2 leading-relaxed">
              We&apos;ll process your transfer within 24 hours and notify you by email.
            </p>
            <button type="button" onClick={onDone}
              className="h-[52px] w-full rounded-2xl bg-brand text-white font-bold text-[15px]">
              Done
            </button>
          </div>
        ) : (
          <div className="overflow-y-auto px-5 pb-6 flex flex-col gap-3">
            <p className="text-[13px] text-ink-2">
              Available: <span className="font-semibold text-ink">{formatMoney(maxAmount)}</span>
            </p>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-ink-2">Bank</span>
              <input
                type="text"
                placeholder="e.g. GTBank, Opay, Kuda"
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-ink-2">Account number</span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="0000000000"
                value={accountNo}
                onChange={e => setAccountNo(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-ink-2">Account name</span>
              <input
                type="text"
                placeholder="As it appears on your bank app"
                value={accountName}
                onChange={e => setAccountName(e.target.value)}
                className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-ink-2">Amount (₦)</span>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink"
              />
            </label>

            {error && <p className="text-[13px] text-danger">{error}</p>}

            <Button onClick={submit} loading={saving} fullWidth size="lg">
              Request transfer
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
