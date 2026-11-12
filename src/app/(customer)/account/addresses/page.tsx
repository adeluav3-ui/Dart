import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AddressesClient } from './AddressesClient'

export const dynamic = 'force-dynamic'

export default async function AddressesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/account/addresses')

  const [{ data: addresses }, { data: areas }, { data: spots }] = await Promise.all([
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
    supabase
      .from('delivery_spots')
      .select('id, label, custom_label, description, area_id, is_default, created_at')
      .order('created_at', { ascending: true }),
  ])

  return (
    <AddressesClient
      userId={user.id}
      addresses={addresses ?? []}
      areas={areas ?? []}
      spots={spots ?? []}
    />
  )
}
