import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendOrderPickedUpEmail,
  sendOrderDeliveredEmail,
  sendRefundEmail,
} from '@/lib/email'
import type { OrderStatus } from '@/types/database'

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('roles')
    .eq('id', user.id)
    .single()

  const body = await req.json()
  const { toStatus, prepMins, note, deliveryPin } = body as {
    toStatus: OrderStatus
    prepMins?: number
    note?: string
    deliveryPin?: string
  }

  // Load order to verify permission
  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('*, vendors(owner_id)')
    .eq('id', params.orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Permission checks
  const isAdmin = profile?.roles?.includes('admin') ?? false
  const isVendor = order.vendors?.owner_id === user.id
  const isRider = order.rider_id === user.id
  const isCustomer = order.customer_id === user.id

  const allowed = (() => {
    switch (toStatus) {
      case 'accepted': return isVendor || isAdmin
      case 'ready': return isVendor || isAdmin
      case 'picked_up': return isRider || isAdmin
      case 'delivered': return isRider || isAdmin
      case 'cancelled': return isVendor || isCustomer || isAdmin
      default: return isAdmin
    }
  })()

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // PIN check for delivery
  if (toStatus === 'delivered') {
    if (!deliveryPin || deliveryPin !== order.delivery_pin) {
      return NextResponse.json({ error: 'Invalid delivery PIN' }, { status: 400 })
    }
  }

  try {
    const { data: updated, error } = await admin.rpc('transition_order', {
      p_order_id: params.orderId,
      p_to_status: toStatus,
      p_actor_id: user.id,
      p_note: note ?? null,
      p_prep_mins: prepMins ?? null,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (toStatus === 'cancelled') {
      await triggerRefund(params.orderId, admin)
    }

    // Email customer on key status changes (fire-and-forget)
    if (toStatus === 'picked_up' || toStatus === 'delivered') {
      notifyCustomer(params.orderId, toStatus, admin).catch(() => {})
    }

    return NextResponse.json({ order: updated })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function notifyCustomer(
  orderId: string,
  toStatus: OrderStatus,
  admin: ReturnType<typeof createAdminClient>
) {
  const { data: order } = await admin
    .from('orders')
    .select('code, delivery_pin, customer_id')
    .eq('id', orderId)
    .single()
  if (!order) return

  const { data: authUser } = await admin.auth.admin.getUserById(order.customer_id)
  const email = authUser.user?.email
  if (!email) return

  if (toStatus === 'picked_up') {
    await sendOrderPickedUpEmail({ to: email, orderCode: order.code, deliveryPin: order.delivery_pin })
  } else if (toStatus === 'delivered') {
    await sendOrderDeliveredEmail({ to: email, orderCode: order.code, orderId })
  }
}

async function triggerRefund(orderId: string, admin: ReturnType<typeof createAdminClient>) {
  // Log refund ledger entry — actual Monnify refund called from /api/refund
  const { data: order } = await admin
    .from('orders')
    .select('total, customer_id')
    .eq('id', orderId)
    .single()

  if (!order) return

  await admin.from('ledger_entries').insert({
    order_id: orderId,
    party_type: 'customer',
    party_id: order.customer_id,
    amount: order.total,
    kind: 'refund',
    note: 'Order cancelled — full refund',
  })

  // Fire-and-forget actual Monnify refund
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  }).catch(() => {})
}
