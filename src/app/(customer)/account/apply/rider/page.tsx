import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RiderApplyClient } from './RiderApplyClient'

export default async function RiderApplyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/account/apply/rider')

  const { data: areas } = await supabase
    .from('areas')
    .select('id, name, district')
    .eq('status', 'active')
    .order('sort_order')

  return <RiderApplyClient areas={areas ?? []} userId={user.id} />
}
