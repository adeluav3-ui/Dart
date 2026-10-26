import { createClient } from '@/lib/supabase/server'
import { formatMoney, formatDate } from '@/lib/format'
import Link from 'next/link'

export default async function AdminMoneyPage() {
  const supabase = createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [{ data: unsettled }, { data: recentPayouts }] = await Promise.all([
    supabase
      .from('ledger_entries')
      .select(`
        *,
        orders (code),
        profiles (full_name, phone)
      `)
      .is('settled_at', null)
      .not('party_type', 'eq', 'platform')
      .order('created_at', { ascending: false }),
    supabase
      .from('ledger_entries')
      .select('*, orders(code), profiles(full_name, phone)')
      .not('settled_at', 'is', null)
      .order('settled_at', { ascending: false })
      .limit(20),
  ])

  // Group by party
  const grouped: Record<string, { name: string; amount: number; entries: typeof unsettled }> = {}
  for (const e of unsettled ?? []) {
    const key = `${e.party_type}:${e.party_id}`
    const name = (e as { profiles?: { full_name?: string; phone?: string } }).profiles?.full_name
      ?? (e as { profiles?: { phone?: string } }).profiles?.phone
      ?? e.party_type
    if (!grouped[key]) grouped[key] = { name, amount: 0, entries: [] }
    grouped[key].amount += e.amount
    grouped[key].entries!.push(e)
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-heading font-bold text-xl">Money</h2>

      <section>
        <h3 className="text-[13px] font-bold text-ink-2 uppercase tracking-wide mb-2">Pending payouts</h3>
        {Object.entries(grouped).length === 0 && (
          <p className="text-sm text-ink-2">No pending payouts</p>
        )}
        {Object.entries(grouped).map(([key, { name, amount, entries }]) => (
          <div key={key} className="bg-white rounded-2xl p-4 mb-2 flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-sm">{name}</span>
              <span className="text-xs text-ink-2">{(entries ?? []).length} transactions</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-heading font-extrabold text-lg text-brand">{formatMoney(amount)}</span>
              <MarkPaidButton entryIds={(entries ?? []).map((e: { id: string }) => e.id)} />
            </div>
          </div>
        ))}
      </section>

      <section>
        <h3 className="text-[13px] font-bold text-ink-2 uppercase tracking-wide mb-2">Recent payouts</h3>
        {(recentPayouts ?? []).map(e => (
          <div key={e.id} className="bg-white rounded-2xl px-4 py-3 mb-2 flex justify-between items-center">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-bold">
                {(e as { profiles?: { full_name?: string; phone?: string } }).profiles?.full_name
                  ?? (e as { profiles?: { phone?: string } }).profiles?.phone}
              </span>
              <span className="text-xs text-ink-2">{formatDate(e.settled_at!)} · {(e as { orders?: { code?: string } }).orders?.code}</span>
            </span>
            <span className="font-bold text-brand">{formatMoney(e.amount)}</span>
          </div>
        ))}
      </section>
    </div>
  )
}

function MarkPaidButton({ entryIds }: { entryIds: string[] }) {
  return (
    <form action="/api/admin/mark-paid" method="POST">
      <input type="hidden" name="entryIds" value={entryIds.join(',')} />
      <button
        type="submit"
        className="h-9 px-3 rounded-xl bg-brand text-white text-xs font-bold"
      >
        Mark paid
      </button>
    </form>
  )
}
