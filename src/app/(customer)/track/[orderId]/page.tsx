import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { TrackingClient } from './TrackingClient'

export default async function TrackPage({
  params,
  searchParams,
}: {
  params: { orderId: string }
  searchParams: { confirm?: string }
}) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=/track/${params.orderId}`)

  const { data: order } = await supabase
    .from('orders')
    .select(`
      *,
      vendors (name, cover_photo_url)
    `)
    .eq('id', params.orderId)
    .single()

  if (!order) notFound()

  // Fetch rider name via admin client — orders.rider_id references riders (not profiles directly)
  // and customers can't read the riders table via RLS
  let riderProfile: { full_name: string | null } | null = null
  if ((order as any).rider_id) {
    const admin = createAdminClient()
    const { data: rp } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', (order as any).rider_id)
      .single()
    riderProfile = rp
  }

  const orderWithRider = { ...order, profiles: riderProfile }

  const { data: events } = await supabase
    .from('order_events')
    .select('*')
    .eq('order_id', params.orderId)
    .order('created_at')

  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', params.orderId)

  return (
    <TrackingClient
      initialOrder={orderWithRider}
      initialEvents={events ?? []}
      orderItems={items ?? []}
      isConfirmRedirect={searchParams.confirm === '1'}
    />
  )
}
