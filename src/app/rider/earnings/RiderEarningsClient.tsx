'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { formatMoney, formatTime, formatDate } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { RiderBottomNav } from '@/components/rider/RiderBottomNav'

interface Entry {
  id: string
  amount: number
  kind: string
  settled_at: string | null
  created_at: string
  note: string | null
  orders: {
    code: string
    area_name: string | null
    address_zone: string
    vendors: { areas: { name: string } | null } | null
  } | null
}

interface Props {
  riderId: string
  entries: Entry[]
  payoutBank: string | null
  payoutBankCode: string | null
  payoutAccountName: string | null
  payoutAccountNo: string | null
}

type Tab = 'today' | 'week' | 'payouts'

function isSameDay(dateStr: string, ref: Date): boolean {
  const d = new Date(dateStr)
  return d.getFullYear() === ref.getFullYear()
    && d.getMonth() === ref.getMonth()
    && d.getDate() === ref.getDate()
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (isSameDay(dateStr, today)) return 'Today'
  if (isSameDay(dateStr, yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' })
}

function routeLabel(entry: Entry): string {
  const vendorArea = entry.orders?.vendors?.areas?.name
  const customerArea = entry.orders?.area_name ?? entry.orders?.address_zone
  if (vendorArea && customerArea) return `${vendorArea} → ${customerArea}`
  if (customerArea) return customerArea
  return entry.orders?.code ?? 'Trip'
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
              To enable withdrawals, go to your profile, re-select your bank from the dropdown, and save your payout account.
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
          {hasBankCode && (
            <Button onClick={withdraw} loading={loading} fullWidth size="lg">
              Confirm withdrawal
            </Button>
          )}
          {!hasBankCode && (
            <Link href="/rider/profile" className="no-underline">
              <Button variant="secondary" fullWidth size="lg">Go to profile</Button>
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

export function RiderEarningsClient({ entries, payoutBank, payoutBankCode, payoutAccountName, payoutAccountNo }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('today')
  const [showWithdraw, setShowWithdraw] = useState(false)

  const today = new Date()

  const todayEntries = entries.filter(e => isSameDay(e.created_at, today))
  const todayAmount = todayEntries.reduce((s, e) => s + e.amount, 0)
  const todayTrips = todayEntries.length

  const owedAmount = entries.filter(e => !e.settled_at).reduce((s, e) => s + e.amount, 0)

  const weekDays: { label: string; entries: Entry[]; total: number }[] = []
  const seenDays = new Set<string>()
  for (const entry of entries) {
    const d = new Date(entry.created_at)
    const dayKey = d.toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos' })
    if (!seenDays.has(dayKey)) {
      seenDays.add(dayKey)
      const dayEntries = entries.filter(e => {
        const ed = new Date(e.created_at)
        return ed.toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos' }) === dayKey
      })
      weekDays.push({
        label: dayLabel(entry.created_at),
        entries: dayEntries,
        total: dayEntries.reduce((s, e) => s + e.amount, 0),
      })
    }
  }

  const payoutEntries = entries.filter(e => e.settled_at)
  const last4 = payoutAccountNo ? `••${payoutAccountNo.slice(-4)}` : null

  return (
    <div className="min-h-screen bg-canvas font-body text-ink"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}>

      <header className="bg-white px-5 pt-5 pb-4 border-b border-line">
        <h1 className="font-heading font-extrabold text-[26px] text-ink">Earnings</h1>
      </header>

      <div className="px-4 py-4 flex flex-col gap-3">
        {/* Owed card */}
        <div className="bg-ink rounded-2xl p-5 flex flex-col gap-1.5">
          <p className="text-[12px] text-white/60 font-medium">Pending earnings</p>
          <p className="font-heading font-extrabold text-[36px] text-white leading-tight">
            {formatMoney(owedAmount)}
          </p>
          <p className="text-[13px] text-white/70">
            {todayTrips} {todayTrips === 1 ? 'trip' : 'trips'} today
            {payoutBank && last4 ? ` · ${payoutBank} ${last4}` : ''}
          </p>
          <div className="flex items-center gap-3 mt-1">
            {owedAmount > 0 ? (
              <button
                type="button"
                onClick={() => setShowWithdraw(true)}
                className="h-9 px-4 rounded-xl bg-brand-bright text-ink font-bold text-[13px] inline-flex items-center"
              >
                Withdraw
              </button>
            ) : null}
            <Link
              href="/rider/profile"
              className="text-[13px] font-semibold text-white/60 no-underline"
            >
              {payoutAccountNo ? 'Change payout account' : 'Set up payout account →'}
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-surface rounded-2xl p-1 grid grid-cols-3">
          {(['today', 'week', 'payouts'] as Tab[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`py-2 rounded-xl text-[13px] font-semibold capitalize transition-colors ${
                tab === t ? 'bg-white text-ink shadow-sm' : 'text-ink-2'
              }`}
            >
              {t === 'today' ? 'Today' : t === 'week' ? 'This week' : 'Payouts'}
            </button>
          ))}
        </div>

        {/* Today */}
        {tab === 'today' && (
          <>
            {todayEntries.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center text-ink-2">No trips today yet</div>
            ) : (
              <div className="bg-white rounded-2xl overflow-hidden">
                {todayEntries.map((entry, i) => (
                  <div key={entry.id}
                    className={`px-4 py-3.5 flex items-center justify-between gap-3 ${i < todayEntries.length - 1 ? 'border-b border-line' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold text-ink truncate">{routeLabel(entry)}</p>
                      <p className="text-[12px] text-ink-2">
                        {entry.orders?.code ?? '—'} · {formatTime(entry.created_at)}
                      </p>
                    </div>
                    <span className="text-[15px] font-bold text-brand shrink-0">+{formatMoney(entry.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-surface rounded-2xl px-4 py-3.5 flex gap-3 items-start">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B6168" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-[12px] text-ink-2 leading-relaxed">
                You&apos;re paid for every trip confirmed with the customer&apos;s PIN. Pay depends on the distance from the vendor to the customer.
              </p>
            </div>
          </>
        )}

        {/* This week */}
        {tab === 'week' && (
          <>
            {weekDays.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center text-ink-2">No trips this week</div>
            ) : (
              weekDays.map(day => (
                <div key={day.label} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[12px] font-semibold text-ink-2">{day.label}</p>
                    <p className="text-[12px] font-bold text-brand">{formatMoney(day.total)}</p>
                  </div>
                  <div className="bg-white rounded-2xl overflow-hidden">
                    {day.entries.map((entry, i) => (
                      <div key={entry.id}
                        className={`px-4 py-3 flex items-center justify-between gap-3 ${i < day.entries.length - 1 ? 'border-b border-line' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-ink truncate">{routeLabel(entry)}</p>
                          <p className="text-[12px] text-ink-2">{formatTime(entry.created_at)}</p>
                        </div>
                        <span className="text-[14px] font-bold text-brand shrink-0">+{formatMoney(entry.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* Payouts */}
        {tab === 'payouts' && (
          <>
            {payoutEntries.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center text-ink-2">No payouts yet</div>
            ) : (
              <div className="bg-white rounded-2xl overflow-hidden">
                {payoutEntries.map((entry, i) => (
                  <div key={entry.id}
                    className={`px-4 py-3.5 flex items-center justify-between gap-3 ${i < payoutEntries.length - 1 ? 'border-b border-line' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold text-ink">{formatDate(entry.settled_at!)}</p>
                      <p className="text-[12px] text-ink-2">Paid</p>
                    </div>
                    <span className="text-[14px] font-bold text-ink shrink-0">{formatMoney(entry.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showWithdraw && (
        <WithdrawSheet
          amount={owedAmount}
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

      <RiderBottomNav />
    </div>
  )
}
