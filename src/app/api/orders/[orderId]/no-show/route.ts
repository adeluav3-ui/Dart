import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const WAIT_MINUTES = 10

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
    .select('id, code, rider_id, status, gate_arrived_at, gate_no_show, customer_id, vendor_id')
    .eq('id', params.orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.rider_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (order.status !== 'picked_up') return NextResponse.json({ error: 'Order not in picked_up state' }, { status: 400 })
  if (!order.gate_arrived_at) return NextResponse.json({ error: 'Arrival not yet recorded' }, { status: 400 })
  if (order.gate_no_show) return NextResponse.json({ error: 'Already marked no-show' }, { status: 400 })

  const arrivedAt = new Date(order.gate_arrived_at).getTime()
  const elapsed = Date.now() - arrivedAt
  if (elapsed < WAIT_MINUTES * 60 * 1000) {
    const minsLeft = Math.ceil((WAIT_MINUTES * 60 * 1000 - elapsed) / 60000)
    return NextResponse.json(
      { error: `Please wait ${minsLeft} more minute${minsLeft === 1 ? '' : 's'}` },
      { status: 400 }
    )
  }

  const { error } = await admin
    .from('orders')
    .update({ gate_no_show: true, gate_no_show_at: new Date().toISOString() })
    .eq('id', order.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('order_events').insert({
    order_id: order.id,
    from_status: 'picked_up',
    to_status: 'picked_up',
    actor_id: user.id,
    note: 'Customer did not respond — awaiting admin decision',
  })

  // Look up customer email and vendor name
  const [{ data: customerAuth }, { data: vendor }] = await Promise.all([
    admin.auth.admin.getUserById(order.customer_id),
    admin.from('vendors').select('name').eq('id', order.vendor_id).single(),
  ])
  const customerEmail = customerAuth.user?.email ?? null
  const vendorName = vendor?.name ?? ''

  // no_show email to customer
  await admin.rpc('enqueue_notification', {
    p_event: 'no_show',
    p_order_id: order.id,
    p_recipient_user_id: order.customer_id,
    p_recipient_email: customerEmail,
    p_recipient_role: 'customer',
    p_channel: 'email',
    p_title: "We couldn't deliver your order",
    p_body: 'Your rider waited at the gate but could not reach you.',
    p_url: `/track/${order.id}`,
    p_email_subject: `Order ${order.code} — delivery unsuccessful`,
    p_email_template: 'no_show',
    p_payload: {
      order_code: order.code,
      order_id: order.id,
      vendor_name: vendorName,
    },
    p_dedupe_key: `no_show:${order.id}`,
  })

  // Admin alert
  await admin.rpc('enqueue_notification', {
    p_event: 'admin_no_show',
    p_order_id: order.id,
    p_recipient_role: 'admin',
    p_channel: 'email',
    p_title: `No-show — order ${order.code}`,
    p_body: `Customer did not collect order ${order.code} from ${vendorName}. Awaiting admin decision.`,
    p_email_subject: `No-show: order ${order.code}`,
    p_email_template: 'admin_alert',
    p_payload: {
      title: `No-show — order ${order.code}`,
      message: `Customer did not collect order ${order.code} from ${vendorName} after the rider waited ${WAIT_MINUTES} minutes at the gate.`,
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin/orders/${order.id}`,
      action_label: 'View order',
    },
    p_dedupe_key: `admin_no_show:${order.id}`,
  })

  return NextResponse.json({ ok: true })
}
