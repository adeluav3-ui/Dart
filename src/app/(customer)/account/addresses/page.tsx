import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AddressesClient } from './AddressesClient'

export const dynamic = 'force-dynamic'

export default async function AddressesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/account/addresses')

  const [{ data: addresses }, { data: areas }] = await Promise.all([
    supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('areas')
      .select('id, name, district, zone_id')
      .eq('status', 'active')
      .order('sort_order'),
  ])

  return (
    <AddressesClient
      userId={user.id}
      addresses={addresses ?? []}
      areas={areas ?? []}
    />
  )
}
