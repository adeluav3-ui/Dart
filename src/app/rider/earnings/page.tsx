import { createClient } from '@/lib/supabase/server'
import { formatMoney, formatDate } from '@/lib/format'
import Link from 'next/link'

export default async function RiderEarningsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [{ data: todayJobs }, { data: ledger }] = await Promise.all([
    supabase
      .from('orders')
      .select('id')
      .eq('rider_id', user!.id)
      .eq('status', 'delivered')
      .gte('delivered_at', today.toISOString()),
    supabase
      .from('ledger_entries')
      .select('*, orders(code)')
      .eq('party_id', user!.id)
      .eq('party_type', 'rider')
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const pending = (ledger ?? [])
    .filter((e: { settled_at: string | null }) => !e.settled_at)
    .reduce((s: number, e: { amount: number }) => s + e.amount, 0)

  return (
    <div className="min-h-screen bg-canvas font-body text-ink pb-24">
      <header className="bg-white px-5 pt-5 pb-3 border-b border-line">
        <h1 className="font-heading font-extrabold text-xl">Earnings</h1>
      </header>

      <div className="px-4 py-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-2">Trips today</span>
            <span className="font-heading font-extrabold text-3xl">{todayJobs?.length ?? 0}</span>
          </div>
          <div className="bg-brand-tint rounded-2xl p-4 flex flex-col gap-1">
            <span className="text-xs font-semibold text-brand-ink">Pending payout</span>
            <span className="font-heading font-extrabold text-2xl text-brand">{formatMoney(pending)}</span>
          </div>
        </div>

        <h2 className="text-[13px] font-bold text-ink-2 uppercase tracking-wide mt-2">Recent trips</h2>
        {(ledger ?? []).map((e: { id: string; amount: number; settled_at: string | null; orders: { code: string } | null; created_at: string }) => (
          <div key={e.id} className="bg-white rounded-2xl px-4 py-3 flex justify-between items-center">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-bold">{e.orders?.code ?? 'Trip'}</span>
              <span className="text-xs text-ink-2">{formatDate(e.created_at)} · {e.settled_at ? 'Paid' : 'Pending'}</span>
            </span>
            <span className="font-bold text-brand">+{formatMoney(e.amount)}</span>
          </div>
        ))}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 h-[72px] px-3 pb-3.5 pt-2 bg-white border-t border-line grid grid-cols-2">
        <Link href="/rider/jobs" className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-ink-2 no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          Jobs
        </Link>
        <Link href="/rider/earnings" className="flex flex-col items-center justify-center gap-1 text-xs font-bold text-brand no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/></svg>
          Earnings
        </Link>
      </nav>
    </div>
  )
}
