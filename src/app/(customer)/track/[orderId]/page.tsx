import { createClient } from '@/lib/supabase/server'
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
      vendors (name, cover_photo_url),
      profiles!orders_rider_id_fkey (full_name)
    `)
    .eq('id', params.orderId)
    .single()

  if (!order) notFound()

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
      initialOrder={order}
      initialEvents={events ?? []}
      orderItems={items ?? []}
      isConfirmRedirect={searchParams.confirm === '1'}
    />
  )
}
