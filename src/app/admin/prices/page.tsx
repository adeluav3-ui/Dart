import { createAdminClient } from '@/lib/supabase/admin'
import { DeliveryPricesClient } from './DeliveryPricesClient'
import { parseServiceFeeSettings } from '@/lib/serviceFee'

export const dynamic = 'force-dynamic'

export default async function DeliveryPricesPage() {
  const admin = createAdminClient()

  const [
    { data: areas },
    { data: zoneFares },
    { data: fareLevels },
    { data: feeRows },
  ] = await Promise.all([
    admin.from('areas').select('*').order('sort_order'),
    admin.from('zone_fares').select('*'),
    admin.from('fare_levels').select('*').order('sort_order'),
    admin.from('app_settings').select('key, value').in('key', [
      'service_fee_enabled', 'service_fee_type', 'service_fee_percent',
      'service_fee_min', 'service_fee_max', 'service_fee_flat',
    ]),
  ])

  return (
    <DeliveryPricesClient
      initialAreas={areas ?? []}
      initialZoneFares={zoneFares ?? []}
      initialFareLevels={fareLevels ?? []}
      initialFeeSettings={parseServiceFeeSettings(feeRows ?? [])}
    />
  )
}
