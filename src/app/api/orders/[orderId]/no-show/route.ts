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
    .select('id, rider_id, status, gate_arrived_at, gate_no_show')
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

  // TODO: email admin

  return NextResponse.json({ ok: true })
}
