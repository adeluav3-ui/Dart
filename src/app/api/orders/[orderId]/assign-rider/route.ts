import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendRiderAssignedEmail } from '@/lib/email'

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { riderId } = await req.json()
  if (!riderId) return NextResponse.json({ error: 'riderId required' }, { status: 400 })

  const admin = createAdminClient()

  // Verify caller is the vendor owner or admin
  const { data: order } = await admin
    .from('orders')
    .select('id, code, customer_id, status, vendors(owner_id)')
    .eq('id', params.orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'accepted') return NextResponse.json({ error: 'Order not in accepted state' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const vendorRow = Array.isArray(order.vendors) ? order.vendors[0] : order.vendors
  const isVendor = (vendorRow as { owner_id: string } | null)?.owner_id === user.id
  const isAdmin = profile?.role === 'admin'
  if (!isVendor && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Assign rider
  await admin.from('orders').update({ rider_id: riderId }).eq('id', params.orderId)

  // Email customer that rider is assigned (fire-and-forget)
  const { data: riderProfile } = await admin
    .from('profiles')
    .select('full_name, phone')
    .eq('id', riderId)
    .single()

  const { data: customerAuth } = await admin.auth.admin.getUserById(order.customer_id)
  if (customerAuth.user?.email && riderProfile) {
    sendRiderAssignedEmail({
      to: customerAuth.user.email,
      orderCode: order.code,
      riderName: riderProfile.full_name ?? 'Your rider',
      riderPhone: riderProfile.phone ?? '',
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
