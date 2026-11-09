'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X, Info, Plus } from 'lucide-react'
import { formatMoney, formatDate } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import type { LedgerEntry, LedgerKind, Order } from '@/types/database'

type LedgerWithOrder = LedgerEntry & {
  orders: (Pick<Order, 'code' | 'vendor_id'> & {
    vendors: { name: string } | null
  }) | null
}

interface Props {
  balance: number
  entries: LedgerWithOrder[]
  topupSuccess?: boolean
}

const HISTORY_LABELS: Record<LedgerKind, string> = {
  refund: 'Refund',
  topup: 'Top-up',
  payout: 'Deducted',
  adjustment: 'Used at checkout',
  earning: 'Credit',
}

const PRESETS = [20_000, 50_000, 100_000, 200_000] // kobo: ₦200, ₦500, ₦1000, ₦2000

function formatPreset(kobo: number) {
  return `₦${(kobo / 100).toLocaleString('en-NG')}`
}

function TopupSheet({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<number | null>(null)
  const [custom, setCustom] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const customKobo = custom ? Math.round(parseFloat(custom) * 100) : 0
  const amount = selected ?? (customKobo > 0 ? customKobo : null)

  async function handleTopup() {
    if (!amount) { setError('Select or enter an amount'); return }
    if (amount < 10_000) { setError('Minimum top-up is ₦100'); return }
    if (amount > 5_000_000) { setError('Maximum top-up is ₦50,000'); return }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Something went wrong'); return }
      window.location.href = json.checkoutUrl
    } catch {
      setError('Something went wrong. Please try again.')
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
          <span className="font-heading font-bold text-[17px]">Top up wallet</span>
          <button type="button" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-surface">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pb-6 flex flex-col gap-4">
          {/* Preset amounts */}
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => { setSelected(p); setCustom('') }}
                className={`h-12 rounded-2xl text-[14px] font-bold border transition-colors ${
                  selected === p
                    ? 'bg-brand text-white border-brand'
                    : 'bg-surface text-ink border-transparent'
                }`}
              >
                {formatPreset(p)}
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
            Custom amount (₦)
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-ink-2 font-semibold">₦</span>
              <input
                type="number"
                value={custom}
                min={100}
                max={50000}
                step={1}
                onChange={e => { setCustom(e.target.value); setSelected(null) }}
                placeholder="e.g. 1500"
                className="w-full h-[48px] pl-7 pr-3 rounded-xl border border-line font-body text-[15px] text-ink"
              />
            </div>
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button
            onClick={handleTopup}
            loading={loading}
            disabled={!amount}
            fullWidth
            size="lg"
          >
            {amount ? `Top up ${formatMoney(amount)}` : 'Top up'}
          </Button>

          <p className="text-[12px] text-ink-2 text-center leading-relaxed">
            You&apos;ll be taken to Monnify to complete payment securely.
            Credit is added to your wallet within seconds.
          </p>
        </div>
      </div>
    </>
  )
}

export function WalletClient({ balance, entries, topupSuccess = false }: Props) {
  const [topupOpen, setTopupOpen] = useState(false)

  return (
    <div className="min-h-dvh bg-canvas font-body text-ink"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>

      <header className="bg-white px-5 pt-5 pb-4">
        <h1 className="font-heading font-extrabold text-[26px] text-ink">Wallet</h1>
      </header>

      <div className="px-4 pt-4 flex flex-col gap-3">
        {topupSuccess && (
          <div className="bg-brand-tint border border-brand/20 rounded-2xl px-4 py-3 text-[14px] text-brand-ink font-semibold">
            Top-up successful! Your balance has been updated.
          </div>
        )}

        {/* Balance card */}
        <div className="bg-brand rounded-2xl p-5 overflow-hidden relative">
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full border-[20px] border-white/10 pointer-events-none" />
          <p className="text-[13px] font-semibold text-white/80 mb-1">GoCart credit</p>
          <p className="font-heading font-extrabold text-[40px] text-white leading-none mb-1">
            {formatMoney(balance)}
          </p>
          <p className="text-[13px] text-white/70 mb-4">Used automatically at your next checkout</p>
          <div className="flex items-center gap-2">
            <Link
              href="/home"
              className="h-10 px-5 rounded-xl bg-white text-brand-ink font-bold text-[14px] inline-flex items-center justify-center no-underline"
            >
              Spend it
            </Link>
            <button
              type="button"
              onClick={() => setTopupOpen(true)}
              className="h-10 px-5 rounded-xl bg-white/20 text-white font-bold text-[14px] inline-flex items-center gap-1.5"
            >
              <Plus size={15} strokeWidth={2.5} />
              Top up
            </button>
          </div>
        </div>

        {/* Info note */}
        <div className="bg-white rounded-2xl px-4 py-3 flex gap-3 items-start">
          <Info size={16} className="text-ink-2 shrink-0 mt-0.5" />
          <p className="text-[13px] text-ink-2 leading-relaxed">
            Credit comes from refunds and top-ups.
            It never expires and is applied automatically at checkout.
          </p>
        </div>

        {/* History */}
        {entries.length > 0 && (
          <>
            <p className="font-heading font-bold text-[16px] text-ink mt-1">History</p>
            <div className="bg-white rounded-2xl overflow-hidden">
              {entries.map((e, i) => {
                const isCredit = e.kind === 'refund' || e.kind === 'topup'
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

      {topupOpen && <TopupSheet onClose={() => setTopupOpen(false)} />}
    </div>
  )
}
