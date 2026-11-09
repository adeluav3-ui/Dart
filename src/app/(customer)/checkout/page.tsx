import { createClient } from '@/lib/supabase/server'
import { CheckoutClient } from './CheckoutClient'
import { parseServiceFeeSettings } from '@/lib/serviceFee'
import type { Zone, Area, CoverageArea, LedgerEntry } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function CheckoutPage() {
  const supabase = createClient()

  const [
    { data: { user } },
    { data: zones },
    { data: areas },
    { data: feeRows },
    { data: coverageAreas },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('zones').select('id, name, is_active').eq('is_active', true).order('name'),
    supabase.from('areas').select('*').eq('status', 'active').eq('is_active', true).order('sort_order'),
    supabase.from('app_settings').select('key, value').in('key', [
      'service_fee_enabled', 'service_fee_type', 'service_fee_percent',
      'service_fee_min', 'service_fee_max', 'service_fee_flat',
    ]),
    supabase.from('coverage_areas').select('*').eq('is_active', true),
  ])

  const feeSettings = parseServiceFeeSettings(feeRows ?? [])

  let walletBalance = 0
  if (user) {
    const { data: ledger } = await supabase
      .from('ledger_entries')
      .select('amount, kind')
      .eq('party_id', user.id)
      .eq('party_type', 'customer')
    const entries = (ledger as Pick<LedgerEntry, 'amount' | 'kind'>[]) ?? []
    walletBalance = Math.max(0, entries.reduce((sum, e) => {
      if (e.kind === 'refund' || e.kind === 'topup') return sum + e.amount
      if (e.kind === 'payout' || e.kind === 'adjustment') return sum - e.amount
      return sum
    }, 0))
  }

  return (
    <CheckoutClient
      userId={user?.id ?? null}
      zones={(zones as Zone[]) ?? []}
      areas={(areas as Area[]) ?? []}
      feeSettings={feeSettings}
      coverageAreas={(coverageAreas as CoverageArea[]) ?? []}
      walletBalance={walletBalance}
    />
  )
}
