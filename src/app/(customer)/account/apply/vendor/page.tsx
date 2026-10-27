import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { VendorApplyClient } from './VendorApplyClient'

export default async function VendorApplyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/account/apply/vendor')

  const { data: areas } = await supabase
    .from('areas')
    .select('id, name, district')
    .eq('status', 'active')
    .order('sort_order')

  return <VendorApplyClient areas={areas ?? []} userId={user.id} />
}
