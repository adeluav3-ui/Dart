import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest, { params }: { params: { itemId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('roles')
    .eq('id', user.id)
    .single()
  if (!profile?.roles?.includes('admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { note } = await req.json()
  const admin = createAdminClient()

  const { data: item } = await admin
    .from('menu_items')
    .select('id, status')
    .eq('id', params.itemId)
    .single()

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updates: Record<string, unknown> = { review_note: note ?? null }

  if (item.status === 'in_review') {
    // Reject new item — send back to draft so vendor can fix
    updates.status = 'rejected'
  } else if (item.status === 'live') {
    // Reject pending changes — just clear them
    updates.pending_price = null
    updates.pending_photo_url = null
  }

  await admin.from('menu_items').update(updates).eq('id', params.itemId)

  return NextResponse.json({ ok: true })
}
