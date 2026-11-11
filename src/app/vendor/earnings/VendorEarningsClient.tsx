'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { formatMoney, formatDate } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { VendorNav } from '@/components/vendor/VendorNav'

interface LedgerEntry {
  id: string
  amount: number
  kind: string
  settled_at: string | null
  orders: { code: string; delivered_at: string } | null
}

interface Props {
  todayTotal: number
  todayOrderCount: number
  pendingPayout: number
  ledger: LedgerEntry[]
  payoutBank: string | null
  payoutBankCode: string | null
  payoutAccountName: string | null
  payoutAccountNo: string | null
}

function WithdrawSheet({
  amount,
  bankName,
  accountName,
  accountNo,
  hasBankCode,
  onClose,
  onSuccess,
}: {
  amount: number
  bankName: string
  accountName: string
  accountNo: string
  hasBankCode: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function withdraw() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/payout/withdraw', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Something went wrong'); return }
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-3xl max-w-md mx-auto flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
          <span className="font-heading font-bold text-[17px]">Withdraw earnings</span>
          <button type="button" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-surface">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 pb-6 flex flex-col gap-4">
          {!hasBankCode ? (
            <div className="bg-warn-tint rounded-2xl px-4 py-3 text-[13px] text-warn leading-relaxed">
              To enable withdrawals, go to Shop Settings, re-select your bank from the dropdown, and save your payout account.
            </div>
          ) : (
            <div className="bg-surface rounded-2xl p-4 flex flex-col gap-2.5">
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-ink-2">Amount</span>
                <span className="font-heading font-extrabold text-[20px] text-brand">{formatMoney(amount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-ink-2">Bank</span>
                <span className="text-[14px] font-semibold text-ink">{bankName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-ink-2">Account</span>
                <span className="text-[14px] font-semibold text-ink">{accountName} ••{accountNo.slice(-4)}</span>
              </div>
            </div>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          {hasBankCode ? (
            <Button onClick={withdraw} loading={loading} fullWidth size="lg">
              Confirm withdrawal
            </Button>
          ) : (
            <Link href="/vendor/shop" className="no-underline">
              <Button variant="secondary" fullWidth size="lg">Go to shop settings</Button>
            </Link>
          )}
          {hasBankCode && (
            <p className="text-[12px] text-ink-2 text-center">Funds arrive in your account within minutes.</p>
          )}
        </div>
      </div>
    </>
  )
}

export function VendorEarningsClient({
  todayTotal, todayOrderCount, pendingPayout, ledger,
  payoutBank, payoutBankCode, payoutAccountName, payoutAccountNo,
}: Props) {
  const router = useRouter()
  const [showWithdraw, setShowWithdraw] = useState(false)

  return (
    <div className="min-h-screen bg-canvas font-body text-ink pb-24">
      <header className="bg-white px-5 pt-5 pb-3 border-b border-line">
        <h1 className="font-heading font-extrabold text-xl">Earnings</h1>
      </header>

      <div className="px-4 py-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-2">Today&apos;s revenue</span>
            <span className="font-heading font-extrabold text-2xl">{formatMoney(todayTotal)}</span>
            <span className="text-xs text-ink-2">{todayOrderCount} orders</span>
          </div>
          <div className="bg-brand-tint rounded-2xl p-4 flex flex-col gap-1">
            <span className="text-xs font-semibold text-brand-ink">Pending payout</span>
            <span className="font-heading font-extrabold text-2xl text-brand">{formatMoney(pendingPayout)}</span>
            <span className="text-xs text-brand-ink">After commission</span>
          </div>
        </div>

        {/* Withdraw button */}
        {pendingPayout > 0 && (
          <button
            type="button"
            onClick={() => setShowWithdraw(true)}
            className="h-12 rounded-2xl bg-brand text-white font-bold text-[15px] w-full"
          >
            Withdraw {formatMoney(pendingPayout)}
          </button>
        )}
        {pendingPayout === 0 && !payoutAccountNo && (
          <Link href="/vendor/shop"
            className="h-12 rounded-2xl bg-surface text-ink-2 font-semibold text-[14px] w-full flex items-center justify-center no-underline">
            Set up payout account →
          </Link>
        )}

        <h2 className="text-[13px] font-bold text-ink-2 uppercase tracking-wide mt-2">Recent transactions</h2>
        {ledger.map(entry => (
          <div key={entry.id} className="bg-white rounded-2xl px-4 py-3 flex justify-between items-center">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-bold">{entry.orders?.code ?? 'Adjustment'}</span>
              <span className="text-xs text-ink-2">
                {entry.orders?.delivered_at ? formatDate(entry.orders.delivered_at) : '—'}
                {entry.settled_at ? ' · Paid' : ' · Pending'}
              </span>
            </span>
            <span className={`font-bold text-[15px] ${entry.kind === 'refund' ? 'text-danger' : 'text-brand'}`}>
              {entry.kind === 'refund' ? '-' : '+'}{formatMoney(entry.amount)}
            </span>
          </div>
        ))}
      </div>

      {showWithdraw && (
        <WithdrawSheet
          amount={pendingPayout}
          bankName={payoutBank ?? ''}
          accountName={payoutAccountName ?? ''}
          accountNo={payoutAccountNo ?? ''}
          hasBankCode={!!payoutBankCode}
          onClose={() => setShowWithdraw(false)}
          onSuccess={() => {
            setShowWithdraw(false)
            router.refresh()
          }}
        />
      )}

      <VendorNav />
    </div>
  )
}
