import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { vendorName, orderCode } = await req.json()

  const admin = createAdminClient()
  await admin.rpc('enqueue_notification', {
    p_event: 'admin_no_rider',
    p_order_id: params.orderId,
    p_recipient_role: 'admin',
    p_channel: 'email',
    p_title: `No rider available — ${orderCode}`,
    p_body: `${vendorName} flagged that no rider is available for order ${orderCode}.`,
    p_email_subject: `No rider available — ${orderCode}`,
    p_email_template: 'admin_alert',
    p_payload: {
      title: `No rider available — ${orderCode}`,
      message: `Order ${orderCode} from ${vendorName} has no rider. The vendor flagged that no rider is free.`,
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin/orders/${params.orderId}`,
      action_label: 'Assign rider',
    },
    p_dedupe_key: `admin_no_rider:${params.orderId}`,
  })

  return NextResponse.json({ ok: true })
}
