import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { HomeClient } from '../HomeClient'
import type { Vendor, Zone, Area, DeliveryPricingSettings, CoverageArea } from '@/types/database'

export const metadata: Metadata = { robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = createClient()

  const [
    { data: { user } },
    { data: rawVendors },
    { data: zones },
    { data: areas },
    { data: pricingSettings },
    { data: coverageAreas },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('vendors')
      .select('*, menu_categories(name)')
      .eq('is_verified', true)
      .eq('is_active', true)
      .order('is_open', { ascending: false })
      .order('rating_avg', { ascending: false }),
    supabase.from('zones').select('*').eq('is_active', true).order('name'),
    supabase.from('areas').select('*').eq('is_active', true).order('status').order('sort_order'),
    supabase.from('delivery_pricing_settings').select('*').eq('id', 1).single(),
    supabase.from('coverage_areas').select('*').eq('is_active', true),
  ])

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
      pricingSettings={(pricingSettings as DeliveryPricingSettings) ?? null}
      coverageAreas={(coverageAreas as CoverageArea[]) ?? []}
    />
  )
}
