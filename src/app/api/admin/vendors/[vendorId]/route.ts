import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { vendorId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { is_active?: boolean }
  if (typeof body.is_active !== 'boolean') {
    return NextResponse.json({ error: 'is_active must be a boolean' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('vendors')
    .update({ is_active: body.is_active })
    .eq('id', params.vendorId)
    .select('id, is_active')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, vendor: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { vendorId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // Find the vendor to get owner_id
  const { data: vendor } = await admin.from('vendors').select('id, owner_id').eq('id', params.vendorId).single()
  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

  // Permanently deactivate vendor and wipe their menu
  await Promise.all([
    admin.from('vendors').update({ is_active: false, is_verified: false }).eq('id', params.vendorId),
    admin.from('menu_items').delete().eq('vendor_id', params.vendorId),
    admin.from('menu_categories').delete().eq('vendor_id', params.vendorId),
  ])

  // Revert owner's role to customer so they lose vendor dashboard access
  if (vendor.owner_id) {
    await admin.from('profiles').update({ role: 'customer' }).eq('id', vendor.owner_id)
  }

  return NextResponse.json({ ok: true })
}
