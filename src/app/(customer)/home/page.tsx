import { createClient } from '@/lib/supabase/server'

export const revalidate = 60
import { HomeClient } from '../HomeClient'
import type { Vendor, Zone, Area, ZoneFare, FareLevel } from '@/types/database'

export default async function HomePage() {
  const supabase = createClient()

  const [
    { data: { user } },
    { data: rawVendors },
    { data: zones },
    { data: areas },
    { data: zoneFares },
    { data: fareLevels },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('vendors')
      .select('*, menu_categories(name)')
      .eq('is_verified', true)
      .order('is_open', { ascending: false })
      .order('rating_avg', { ascending: false }),
    supabase.from('zones').select('*').eq('is_active', true).order('name'),
    supabase.from('areas').select('*').order('status').order('sort_order'),
    supabase.from('zone_fares').select('*'),
    supabase.from('fare_levels').select('*').order('sort_order'),
  ])

  // Flatten menu_categories into a string array for each vendor
  const vendors: (Vendor & { menuCategoryNames: string[] })[] = (rawVendors ?? []).map((v: any) => {
    const { menu_categories, ...rest } = v
    return {
      ...rest,
      menuCategoryNames: (menu_categories ?? []).map((c: { name: string }) => c.name),
    }
  })

  return (
    <HomeClient
      userId={user?.id ?? null}
      vendors={vendors}
      zones={(zones as Zone[]) ?? []}
      areas={(areas as Area[]) ?? []}
      zoneFares={(zoneFares as ZoneFare[]) ?? []}
      fareLevels={(fareLevels as FareLevel[]) ?? []}
    />
  )
}
