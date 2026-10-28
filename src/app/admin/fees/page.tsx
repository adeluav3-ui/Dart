import { createAdminClient } from '@/lib/supabase/admin'
import { FeesClient } from './FeesClient'
import { parseServiceFeeSettings } from '@/lib/serviceFee'

export const dynamic = 'force-dynamic'

export default async function AdminFeesPage() {
  const admin = createAdminClient()
  const { data: rows } = await admin
    .from('app_settings')
    .select('key, value')
    .in('key', [
      'service_fee_enabled', 'service_fee_type', 'service_fee_percent',
      'service_fee_min', 'service_fee_max', 'service_fee_flat',
    ])

  const settings = parseServiceFeeSettings(rows ?? [])
  return <FeesClient initialSettings={settings} />
}
