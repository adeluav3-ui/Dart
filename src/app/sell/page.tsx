import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SellPageClient } from './SellPageClient'

export default async function SellPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If signed in, send to the proper apply form
  if (user) redirect('/account/apply/vendor')

  const { data: areas } = await supabase
    .from('areas')
    .select('id, name, district')
    .eq('status', 'active')
    .order('sort_order')

  return <SellPageClient areas={areas ?? []} />
}
