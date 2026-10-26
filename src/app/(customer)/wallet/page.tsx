import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatMoney, formatDate } from '@/lib/format'
import Link from 'next/link'

export default async function WalletPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/wallet')

  const { data: ledger } = await supabase
    .from('ledger_entries')
    .select('*, orders(code, vendors(name))')
    .eq('party_id', user.id)
    .eq('party_type', 'customer')
    .order('created_at', { ascending: false })
    .limit(30)

  const balance = (ledger ?? []).reduce((sum: number, e: { amount: number; kind: string }) => {
    return e.kind === 'refund' ? sum + e.amount : sum
  }, 0)

  return (
    <div className="min-h-screen bg-canvas font-body text-ink pb-24">
      <header className="bg-white px-5 pt-5 pb-3 border-b border-line">
        <h1 className="font-heading font-extrabold text-2xl">Wallet</h1>
      </header>

      <div className="px-4 py-4 flex flex-col gap-3">
        <div className="bg-brand rounded-2xl p-5 flex flex-col gap-1 text-white">
          <span className="text-sm font-semibold text-white/80">Refund balance</span>
          <span className="font-heading font-extrabold text-4xl">{formatMoney(balance)}</span>
          <span className="text-xs text-white/70">Applied automatically at checkout</span>
        </div>

        <h2 className="text-[13px] font-bold text-ink-2 uppercase tracking-wide mt-2">Transactions</h2>
        {(ledger ?? []).map((e: { id: string; amount: number; kind: string; created_at: string; orders?: { code: string; vendors?: { name: string } } | null }) => (
          <div key={e.id} className="bg-white rounded-2xl px-4 py-3 flex justify-between items-center">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold">
                {e.kind === 'refund' ? 'Refund' : 'Charge'} — {e.orders?.code ?? '—'}
              </span>
              <span className="text-xs text-ink-2">
                {e.orders?.vendors?.name ?? ''} · {formatDate(e.created_at)}
              </span>
            </div>
            <span className={`font-bold text-[15px] ${e.kind === 'refund' ? 'text-brand' : 'text-danger'}`}>
              {e.kind === 'refund' ? '+' : '-'}{formatMoney(e.amount)}
            </span>
          </div>
        ))}

        {(ledger ?? []).length === 0 && (
          <p className="text-center text-ink-2 py-8">No transactions yet</p>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 h-[76px] px-3 pb-4 pt-2 bg-white border-t border-line grid grid-cols-4">
        <Link href="/" className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-ink-2 no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>
          Home
        </Link>
        <Link href="/orders" className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-ink-2 no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 4h10a1 1 0 0 1 1 1v15l-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1z"/><path d="M9 9h6M9 13h4"/></svg>
          Orders
        </Link>
        <Link href="/wallet" className="flex flex-col items-center justify-center gap-1 text-xs font-bold text-brand no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12.5h2M3 10h18"/></svg>
          Wallet
        </Link>
        <Link href="/account" className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-ink-2 no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>
          Account
        </Link>
      </nav>
    </div>
  )
}
