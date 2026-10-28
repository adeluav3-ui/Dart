import { createAdminClient } from '@/lib/supabase/admin'
import { DeliveryPricesClient } from './DeliveryPricesClient'

export const dynamic = 'force-dynamic'

export default async function DeliveryPricesPage() {
  const admin = createAdminClient()

  const [
    { data: areas },
    { data: zoneFares },
    { data: fareLevels },
  ] = await Promise.all([
    admin.from('areas').select('*').order('sort_order'),
    admin.from('zone_fares').select('*'),
    admin.from('fare_levels').select('*').order('sort_order'),
  ])

  return (
    <DeliveryPricesClient
      initialAreas={areas ?? []}
      initialZoneFares={zoneFares ?? []}
      initialFareLevels={fareLevels ?? []}
    />
  )
}
