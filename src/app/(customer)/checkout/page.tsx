import { createClient } from '@/lib/supabase/server'
import { CheckoutClient } from './CheckoutClient'
import { parseServiceFeeSettings } from '@/lib/serviceFee'
import type { Zone, ZoneFare, Area, FareLevel } from '@/types/database'

export const revalidate = 60

export default async function CheckoutPage() {
  const supabase = createClient()

  const [
    { data: { user } },
    { data: zones },
    { data: areas },
    { data: fares },
    { data: fareLevels },
    { data: feeRows },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('zones').select('id, name, is_active').eq('is_active', true).order('name'),
    supabase.from('areas').select('*').eq('status', 'active').order('sort_order'),
    supabase.from('zone_fares').select('*'),
    supabase.from('fare_levels').select('*').order('sort_order'),
    supabase.from('app_settings').select('key, value').in('key', [
      'service_fee_enabled', 'service_fee_type', 'service_fee_percent',
      'service_fee_min', 'service_fee_max', 'service_fee_flat',
    ]),
  ])

  const feeSettings = parseServiceFeeSettings(feeRows ?? [])

  return (
    <CheckoutClient
      userId={user?.id ?? null}
      zones={(zones as Zone[]) ?? []}
      areas={(areas as Area[]) ?? []}
      fares={(fares as ZoneFare[]) ?? []}
      fareLevels={(fareLevels as FareLevel[]) ?? []}
      feeSettings={feeSettings}
    />
  )
}
