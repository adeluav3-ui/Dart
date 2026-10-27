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
    .select('id, rider_id, status, is_gate_pickup, gate_arrived_at, address_phone, customer_id')
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

  // TODO: email customer at their account email: "Your rider is at the gate — come out to collect your order."

  return NextResponse.json({ ok: true })
}
