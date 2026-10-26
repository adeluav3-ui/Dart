import { createClient } from '@/lib/supabase/server'
import { HomeClient } from '../HomeClient'
import type { Vendor, Zone } from '@/types/database'

export default async function HomePage() {
  const supabase = createClient()

  const [{ data: vendors }, { data: zones }] = await Promise.all([
    supabase
      .from('vendors')
      .select('*')
      .eq('is_verified', true)
      .order('is_open', { ascending: false })
      .order('rating_avg', { ascending: false }),
    supabase.from('zones').select('*').eq('is_active', true).order('name'),
  ])

  return (
    <HomeClient
      vendors={(vendors as Vendor[]) ?? []}
      zones={(zones as Zone[]) ?? []}
    />
  )
}
