import { createClient } from '@/lib/supabase/server'

export const revalidate = 60
import { HomeClient } from '../HomeClient'
import type { Vendor, Zone, Area, ZoneFare } from '@/types/database'

export default async function HomePage() {
  const supabase = createClient()

  const [
    { data: { user } },
    { data: vendors },
    { data: zones },
    { data: areas },
    { data: zoneFares },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('vendors')
      .select('*')
      .eq('is_verified', true)
      .order('is_open', { ascending: false })
      .order('rating_avg', { ascending: false }),
    supabase.from('zones').select('*').eq('is_active', true).order('name'),
    supabase.from('areas').select('*').order('status').order('sort_order'),
    supabase.from('zone_fares').select('*'),
  ])

  return (
    <HomeClient
      userId={user?.id ?? null}
      vendors={(vendors as Vendor[]) ?? []}
      zones={(zones as Zone[]) ?? []}
      areas={(areas as Area[]) ?? []}
      zoneFares={(zoneFares as ZoneFare[]) ?? []}
    />
  )
}
