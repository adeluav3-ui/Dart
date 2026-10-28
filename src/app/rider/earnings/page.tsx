import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { RiderEarningsClient } from './RiderEarningsClient'

export const dynamic = 'force-dynamic'

export default async function RiderEarningsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 6)
  weekStart.setHours(0, 0, 0, 0)

  const [{ data: ledger }, { data: rider }] = await Promise.all([
    admin
      .from('ledger_entries')
      .select(`
        id, amount, kind, settled_at, created_at, note,
        orders(code, area_name, address_zone, vendor_id, vendors(area_id, areas(name)))
      `)
      .eq('party_id', user.id)
      .eq('party_type', 'rider')
      .gte('created_at', weekStart.toISOString())
      .order('created_at', { ascending: false }),
    admin
      .from('riders')
      .select('payout_bank, payout_account_name, payout_account_no')
      .eq('id', user.id)
      .single(),
  ])

  return (
    <RiderEarningsClient
      riderId={user.id}
      entries={(ledger ?? []) as any[]}
      payoutBank={rider?.payout_bank ?? null}
      payoutAccountName={rider?.payout_account_name ?? null}
      payoutAccountNo={rider?.payout_account_no ?? null}
    />
  )
}
