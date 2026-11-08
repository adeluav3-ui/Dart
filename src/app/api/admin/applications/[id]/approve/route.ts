import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('roles').eq('id', user.id).single()
  if (!profile?.roles?.includes('admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const { data: app } = await admin
    .from('applications')
    .select('*, profiles(full_name, roles)')
    .eq('id', params.id)
    .single()

  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (app.status !== 'submitted' && app.status !== 'contacted') {
    return NextResponse.json({ error: 'Application already decided' }, { status: 400 })
  }

  // Add role to user's roles array
  const targetProfile = app.profiles as { full_name: string | null; roles: string[] } | null
  const existing: string[] = targetProfile?.roles ?? ['customer']
  const newRole = app.kind === 'vendor' ? 'vendor' : 'rider'

  if (!existing.includes(newRole)) {
    await admin.from('profiles').update({ roles: [...existing, newRole] }).eq('id', app.user_id)
  }

  // If vendor — create vendor record (is_verified=false so setup checklist kicks in)
  if (app.kind === 'vendor') {
    const data = app.data as Record<string, unknown>
    const slug = String(data.business_name ?? 'vendor')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    const { error: vendorErr } = await admin.from('vendors').insert({
      owner_id: app.user_id,
      name: data.business_name ?? 'Vendor',
      slug,
      type: data.store_type ?? 'restaurant',
      area_id: data.area_id ?? null,
      is_verified: false,
      is_open: false,
      avg_prep_mins: 30,
      commission_rate: 0.10,
      rating_avg: 0,
      rating_count: 0,
    })
    if (vendorErr && !vendorErr.message.includes('duplicate')) {
      return NextResponse.json({ error: vendorErr.message }, { status: 500 })
    }
  }

  // If rider — create rider record
  if (app.kind === 'rider') {
    await admin.from('riders').upsert({
      id: app.user_id,
      is_active: false,
      is_available: false,
    }, { onConflict: 'id', ignoreDuplicates: true })
  }

  // Mark application approved
  const { error: updateErr } = await admin
    .from('applications')
    .update({ status: 'approved', decided_at: new Date().toISOString() })
    .eq('id', params.id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Email the applicant via notification system
  const { data: authUser } = await admin.auth.admin.getUserById(app.user_id)
  const email = authUser.user?.email
  const ownerName = targetProfile?.full_name ?? ''

  if (email) {
    if (app.kind === 'vendor') {
      const appData = app.data as Record<string, unknown>
      const vendorName = String(appData.business_name ?? 'Your store')
      await admin.rpc('enqueue_notification', {
        p_event: 'vendor_approved',
        p_order_id: null,
        p_recipient_user_id: app.user_id,
        p_recipient_email: email,
        p_recipient_role: 'vendor',
        p_channel: 'email',
        p_title: "You're live on GoCart!",
        p_body: `${vendorName} has been approved. Go set up your menu and open your store.`,
        p_url: '/vendor',
        p_email_subject: `${vendorName} is live on GoCart!`,
        p_email_template: 'approved',
        p_payload: { vendor_name: vendorName, owner_name: ownerName },
        p_dedupe_key: `vendor_approved:${app.user_id}`,
      }).then(() => null, () => null)
    } else {
      await admin.rpc('enqueue_notification', {
        p_event: 'rider_approved',
        p_order_id: null,
        p_recipient_user_id: app.user_id,
        p_recipient_email: email,
        p_recipient_role: 'rider',
        p_channel: 'email',
        p_title: "You're a GoCart rider!",
        p_body: 'Your rider application has been approved. Open the app to start receiving jobs.',
        p_url: '/rider',
        p_email_subject: "You're approved — welcome to GoCart",
        p_email_template: 'rider_approved',
        p_payload: { rider_name: ownerName },
        p_dedupe_key: `rider_approved:${app.user_id}`,
      }).then(() => null, () => null)
    }
  }

  return NextResponse.json({
    ok: true,
    updated: { status: 'approved', decided_at: new Date().toISOString() },
  })
}
