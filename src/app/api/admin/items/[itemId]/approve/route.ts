import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(_req: NextRequest, { params }: { params: { itemId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('roles')
    .eq('id', user.id)
    .single()
  if (!profile?.roles?.includes('admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const { data: item } = await admin
    .from('menu_items')
    .select('id, status, pending_price, pending_photo_url')
    .eq('id', params.itemId)
    .single()

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updates: Record<string, unknown> = { review_note: null }

  if (item.status === 'in_review') {
    // New item going live
    updates.status = 'live'
  } else if (item.status === 'live') {
    // Applying pending changes to a live item
    if (item.pending_price != null) {
      updates.base_price = item.pending_price
      updates.pending_price = null
    }
    if (item.pending_photo_url != null) {
      updates.photo_url = item.pending_photo_url
      updates.pending_photo_url = null
    }
  }

  await admin.from('menu_items').update(updates).eq('id', params.itemId)

  return NextResponse.json({ ok: true })
}
