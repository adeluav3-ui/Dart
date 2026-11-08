import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: order } = await admin
    .from('orders')
    .select('id, rider_id, status, is_gate_pickup, gate_arrived_at, address_phone, customer_id, code, delivery_pin')
    .eq('id', params.orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.rider_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (order.status !== 'picked_up') return NextResponse.json({ error: 'Order not in picked_up state' }, { status: 400 })
  if (!order.is_gate_pickup) return NextResponse.json({ error: 'Not a gate pickup order' }, { status: 400 })
  if (order.gate_arrived_at) return NextResponse.json({ error: 'Already marked arrived' }, { status: 400 })

  const { error } = await admin
    .from('orders')
    .update({ gate_arrived_at: new Date().toISOString() })
    .eq('id', order.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('order_events').insert({
    order_id: order.id,
    from_status: 'picked_up',
    to_status: 'picked_up',
    actor_id: user.id,
    note: 'Rider arrived at gate',
  })

  // Look up rider phone
  const { data: riderProfile } = await admin
    .from('profiles')
    .select('phone')
    .eq('id', user.id)
    .single()

  // Look up customer email
  const { data: customerAuth } = await admin.auth.admin.getUserById(order.customer_id)
  const customerEmail = customerAuth.user?.email ?? null

  // Enqueue at_gate notification to customer (email + push)
  await admin.rpc('enqueue_notification', {
    p_event: 'at_gate',
    p_order_id: order.id,
    p_recipient_user_id: order.customer_id,
    p_recipient_email: customerEmail,
    p_recipient_role: 'customer',
    p_channel: 'email',
    p_title: 'Your rider is at the gate',
    p_body: 'Your rider is waiting at the OOUTH Main Gate — come out now.',
    p_url: `/track/${order.id}`,
    p_email_subject: `Your rider is at the gate — order ${order.code}`,
    p_email_template: 'at_gate',
    p_payload: {
      order_code: order.code,
      rider_phone: riderProfile?.phone ?? '',
      order_id: order.id,
    },
    p_dedupe_key: `at_gate:${order.id}`,
  })

  await admin.rpc('enqueue_notification', {
    p_event: 'at_gate',
    p_order_id: order.id,
    p_recipient_user_id: order.customer_id,
    p_recipient_role: 'customer',
    p_channel: 'push',
    p_title: 'Rider at the gate!',
    p_body: 'Come out now — your rider is at the OOUTH Main Gate.',
    p_url: `/track/${order.id}`,
    p_dedupe_key: `at_gate_push:${order.id}`,
  })

  return NextResponse.json({ ok: true })
}
