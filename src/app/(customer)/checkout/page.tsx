import { createClient } from '@/lib/supabase/server'
import { CheckoutClient } from './CheckoutClient'
import type { Zone, ZoneFare, Area } from '@/types/database'

export const revalidate = 60

export default async function CheckoutPage() {
  const supabase = createClient()

  const [{ data: zones }, { data: areas }, { data: fares }] = await Promise.all([
    supabase.from('zones').select('id, name, is_active').eq('is_active', true).order('name'),
    supabase.from('areas').select('*').eq('status', 'active').order('sort_order'),
    supabase.from('zone_fares').select('*'),
  ])

  return (
    <CheckoutClient
      zones={(zones as Zone[]) ?? []}
      areas={(areas as Area[]) ?? []}
      fares={(fares as ZoneFare[]) ?? []}
    />
  )
}
