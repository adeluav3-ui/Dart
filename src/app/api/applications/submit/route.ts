import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { kind: string; data: Record<string, unknown> }
  const { kind, data } = body

  if (kind !== 'vendor' && kind !== 'rider') {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
  }

  // Check for existing open application
  const { data: existing } = await supabase
    .from('applications')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('kind', kind)
    .in('status', ['submitted', 'contacted'])
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'You already have a pending application' }, { status: 409 })
  }

  const { data: app, error } = await supabase
    .from('applications')
    .insert({ user_id: user.id, kind, data })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify admin via notification queue (fire-and-forget, never fails the request)
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const applicantName = profile?.full_name ?? ''
  const admin = createAdminClient()

  const isVendor = kind === 'vendor'
  const displayName = isVendor
    ? String(data.business_name ?? applicantName)
    : applicantName

  await admin.rpc('enqueue_notification', {
    p_event:            'admin_new_application',
    p_order_id:         null,
    p_recipient_role:   'admin',
    p_channel:          'email',
    p_title:            isVendor ? `New vendor application: ${displayName}` : `New rider application: ${displayName}`,
    p_body:             isVendor ? `${displayName} has applied to sell on GoCart.` : `${displayName} has applied to become a GoCart rider.`,
    p_email_subject:    isVendor ? `New vendor application — ${displayName}` : `New rider application — ${displayName}`,
    p_email_template:   'admin_new_application',
    p_payload: {
      kind,
      vendor_name:    displayName,
      applicant_name: applicantName,
      applicant_phone: String(data.phone ?? ''),
      vendor_type:    isVendor ? String(data.store_type ?? '') : 'rider',
    },
    p_dedupe_key: `admin_new_application:${app.id}`,
  }).then(() => null, () => null)

  return NextResponse.json({ ok: true })
}
