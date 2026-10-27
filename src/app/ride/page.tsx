import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RidePageClient } from './RidePageClient'

export default async function RidePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/account/apply/rider')

  const { data: areas } = await supabase
    .from('areas')
    .select('id, name, district')
    .eq('status', 'active')
    .order('sort_order')

  return <RidePageClient areas={areas ?? []} />
}
