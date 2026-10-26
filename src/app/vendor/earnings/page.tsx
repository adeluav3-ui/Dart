import { createClient } from '@/lib/supabase/server'
import { formatMoney, formatDate } from '@/lib/format'
import Link from 'next/link'

export default async function VendorEarningsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: vendor } = await supabase
    .from('vendors')
    .select('id, owner_id')
    .eq('owner_id', user!.id)
    .single()

  if (!vendor) return <p className="p-6 text-ink-2">No vendor account found.</p>

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [{ data: todayOrders }, { data: ledger }] = await Promise.all([
    supabase
      .from('orders')
      .select('total, status')
      .eq('vendor_id', vendor.id)
      .eq('status', 'delivered')
      .gte('delivered_at', today.toISOString()),
    supabase
      .from('ledger_entries')
      .select('*, orders(code, delivered_at)')
      .eq('party_id', user!.id)
      .eq('party_type', 'vendor')
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const todayTotal = (todayOrders ?? []).reduce((sum: number, o: { total: number }) => sum + o.total, 0)
  const pendingPayout = (ledger ?? [])
    .filter((e: { settled_at: string | null; amount: number }) => !e.settled_at)
    .reduce((sum: number, e: { amount: number }) => sum + e.amount, 0)

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
            <span className="text-xs text-ink-2">{todayOrders?.length ?? 0} orders</span>
          </div>
          <div className="bg-brand-tint rounded-2xl p-4 flex flex-col gap-1">
            <span className="text-xs font-semibold text-brand-ink">Pending payout</span>
            <span className="font-heading font-extrabold text-2xl text-brand">{formatMoney(pendingPayout)}</span>
            <span className="text-xs text-brand-ink">After commission</span>
          </div>
        </div>

        <h2 className="text-[13px] font-bold text-ink-2 uppercase tracking-wide mt-2">Recent transactions</h2>
        {(ledger ?? []).map((entry: { id: string; amount: number; kind: string; settled_at: string | null; orders: { code: string; delivered_at: string } | null }) => (
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

      <nav className="fixed bottom-0 left-0 right-0 h-[72px] px-3 pb-3.5 pt-2 bg-white border-t border-line grid grid-cols-3">
        <Link href="/vendor/orders" className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-ink-2 no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 4h10a1 1 0 0 1 1 1v15l-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1z"/></svg>
          Orders
        </Link>
        <Link href="/vendor/menu" className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-ink-2 no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 6h14M5 12h14M5 18h9"/></svg>
          Menu
        </Link>
        <Link href="/vendor/earnings" className="flex flex-col items-center justify-center gap-1 text-xs font-bold text-brand no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/></svg>
          Earnings
        </Link>
      </nav>
    </div>
  )
}
