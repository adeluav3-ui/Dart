import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { VendorEarningsClient } from './VendorEarningsClient'

export const dynamic = 'force-dynamic'

export default async function VendorEarningsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: vendor } = await supabase
    .from('vendors')
    .select('id, owner_id, payout_bank, payout_bank_code, payout_account_name, payout_account_no')
    .eq('owner_id', user!.id)
    .single()

  if (!vendor) return <p className="p-6 text-ink-2">No vendor account found.</p>

  const admin = createAdminClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [{ data: todayOrders }, { data: ledger }] = await Promise.all([
    supabase
      .from('orders')
      .select('total, status')
      .eq('vendor_id', vendor.id)
      .eq('status', 'delivered')
      .gte('delivered_at', today.toISOString()),
    admin
      .from('ledger_entries')
      .select('id, amount, kind, settled_at, orders(code, delivered_at)')
      .eq('party_id', user!.id)
      .eq('party_type', 'vendor')
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const todayTotal = (todayOrders ?? []).reduce((sum: number, o: { total: number }) => sum + o.total, 0)
  const pendingPayout = (ledger ?? [])
    .filter((e: { settled_at: string | null }) => !e.settled_at)
    .reduce((sum: number, e: { amount: number }) => sum + e.amount, 0)

  return (
    <VendorEarningsClient
      todayTotal={todayTotal}
      todayOrderCount={todayOrders?.length ?? 0}
      pendingPayout={pendingPayout}
      ledger={(ledger ?? []) as any[]}
      payoutBank={vendor.payout_bank ?? null}
      payoutBankCode={vendor.payout_bank_code ?? null}
      payoutAccountName={vendor.payout_account_name ?? null}
      payoutAccountNo={vendor.payout_account_no ?? null}
    />
  )
}
