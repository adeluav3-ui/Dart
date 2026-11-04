import { createClient } from '@/lib/supabase/server'
import { CheckoutClient } from './CheckoutClient'
import { parseServiceFeeSettings } from '@/lib/serviceFee'
import type { Zone, Area, CoverageArea } from '@/types/database'

export const revalidate = 60

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

  return (
    <CheckoutClient
      userId={user?.id ?? null}
      zones={(zones as Zone[]) ?? []}
      areas={(areas as Area[]) ?? []}
      feeSettings={feeSettings}
      coverageAreas={(coverageAreas as CoverageArea[]) ?? []}
    />
  )
}
