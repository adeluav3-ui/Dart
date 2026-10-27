'use client'

import Link from 'next/link'
import { Info } from 'lucide-react'
import { formatMoney, formatDate } from '@/lib/format'
import type { LedgerEntry, LedgerKind, Order } from '@/types/database'

type LedgerWithOrder = LedgerEntry & {
  orders: (Pick<Order, 'code' | 'vendor_id'> & {
    vendors: { name: string } | null
  }) | null
}

interface Props {
  balance: number
  entries: LedgerWithOrder[]
}

const HISTORY_LABELS: Record<LedgerKind, string> = {
  refund: 'Refund',
  payout: 'Deducted',
  adjustment: 'Used at checkout',
  earning: 'Credit',
}

export function WalletClient({ balance, entries }: Props) {
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
          <Link
            href="/home"
            className="h-10 px-6 rounded-xl bg-white text-brand-ink font-bold text-[14px] inline-flex items-center justify-center no-underline"
          >
            Spend it
          </Link>
        </div>

        {/* Info note */}
        <div className="bg-white rounded-2xl px-4 py-3 flex gap-3 items-start">
          <Info size={16} className="text-ink-2 shrink-0 mt-0.5" />
          <p className="text-[13px] text-ink-2 leading-relaxed">
            Credit comes from refunds, such as an item a shop didn&apos;t have.
            It never expires and is applied automatically at checkout.
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
    </div>
  )
}
