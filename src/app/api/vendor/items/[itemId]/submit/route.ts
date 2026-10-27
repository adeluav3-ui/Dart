import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAdminItemReviewEmail } from '@/lib/email'

export async function POST(_req: NextRequest, { params }: { params: { itemId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify item belongs to this vendor
  const { data: item } = await admin
    .from('menu_items')
    .select('id, name, status, vendor_id, base_price, photo_url')
    .eq('id', params.itemId)
    .single()

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify ownership
  const { data: vendor } = await admin
    .from('vendors')
    .select('id, name')
    .eq('id', item.vendor_id)
    .eq('owner_id', user.id)
    .single()

  if (!vendor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!['draft', 'rejected'].includes(item.status)) {
    return NextResponse.json({ error: 'Item cannot be submitted from its current status' }, { status: 422 })
  }

  await admin
    .from('menu_items')
    .update({ status: 'in_review', review_note: null })
    .eq('id', params.itemId)

  await sendAdminItemReviewEmail({
    vendorName: vendor.name,
    itemName: item.name,
    vendorId: vendor.id,
  }).catch(() => {}) // non-fatal

  return NextResponse.json({ ok: true })
}
