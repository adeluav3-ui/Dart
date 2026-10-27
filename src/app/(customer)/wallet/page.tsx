import { createClient } from '@/lib/supabase/server'
import { WalletClient } from './WalletClient'
import Link from 'next/link'
import type { LedgerEntry, Order } from '@/types/database'

export const dynamic = 'force-dynamic'

type LedgerWithOrder = LedgerEntry & {
  orders: (Pick<Order, 'code' | 'vendor_id'> & {
    vendors: { name: string } | null
  }) | null
}

export default async function WalletPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="min-h-dvh bg-canvas flex flex-col font-body"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>
        <header className="bg-white px-5 pt-5 pb-4">
          <h1 className="font-heading font-extrabold text-[26px] text-ink">Wallet</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 pb-8">
          <div className="w-20 h-20 rounded-full bg-brand-tint flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0B7A47" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="18" height="13" rx="2"/>
              <path d="M16 12.5h2M3 10h18"/>
            </svg>
          </div>
          <div className="text-center flex flex-col gap-1.5">
            <p className="font-heading font-bold text-[18px] text-ink">Sign in to see your Dart credit</p>
            <p className="text-[14px] text-ink-2">Refunds go here and are used automatically at checkout.</p>
          </div>
          <Link
            href="/login?next=/wallet"
            className="h-[52px] w-full max-w-xs rounded-2xl bg-brand text-white font-body font-bold text-[16px] flex items-center justify-center no-underline"
          >
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  const { data: ledger } = await supabase
    .from('ledger_entries')
    .select('*, orders(code, vendors(name))')
    .eq('party_id', user.id)
    .eq('party_type', 'customer')
    .order('created_at', { ascending: false })
    .limit(50)

  const entries = (ledger as LedgerWithOrder[]) ?? []

  const balance = entries.reduce((sum, e) => {
    if (e.kind === 'refund') return sum + e.amount
    if (e.kind === 'payout' || e.kind === 'adjustment') return sum - e.amount
    return sum
  }, 0)

  return <WalletClient balance={balance} entries={entries} />
}
