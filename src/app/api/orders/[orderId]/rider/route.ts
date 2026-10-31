import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: order } = await admin
    .from('orders')
    .select('rider_id, customer_id')
    .eq('id', params.orderId)
    .single()

  if (!order || order.customer_id !== user.id || !order.rider_id) {
    return NextResponse.json({ name: null, phone: null })
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, phone')
    .eq('id', order.rider_id)
    .single()

  return NextResponse.json({
    name: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
  })
}
