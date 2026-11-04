import { createAdminClient } from '@/lib/supabase/admin'
import { DeliveryPricesClient } from './DeliveryPricesClient'
import { parseServiceFeeSettings } from '@/lib/serviceFee'
import type { DeliveryPricingSettings } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function DeliveryPricesPage() {
  const admin = createAdminClient()

  const [
    { data: pricingSettings },
    { count: googleCallsToday },
    { data: feeRows },
  ] = await Promise.all([
    admin.from('delivery_pricing_settings').select('*').eq('id', 1).single(),
    admin.from('google_call_log').select('id', { count: 'exact', head: true })
      .gte('called_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    admin.from('app_settings').select('key, value').in('key', [
      'service_fee_enabled', 'service_fee_type', 'service_fee_percent',
      'service_fee_min', 'service_fee_max', 'service_fee_flat',
    ]),
  ])

  return (
    <DeliveryPricesClient
      initialSettings={(pricingSettings as DeliveryPricingSettings) ?? null}
      googleCallsToday={googleCallsToday ?? 0}
      initialFeeSettings={parseServiceFeeSettings(feeRows ?? [])}
    />
  )
}
