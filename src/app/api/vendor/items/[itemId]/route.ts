import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findBannedWord } from '@/lib/bannedWords'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { itemId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    name: string
    description: string | null
    category_id: string | null
    pack_size: string | null
    base_price?: number
    in_store_price_kobo: number | null
    photo_url?: string
  }

  const admin = createAdminClient()

  // Verify caller owns the vendor that owns this item
  const { data: item } = await admin
    .from('menu_items')
    .select('id, vendor_id, base_price')
    .eq('id', params.itemId)
    .single()

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: vendor } = await admin
    .from('vendors')
    .select('id')
    .eq('id', item.vendor_id)
    .eq('owner_id', user.id)
    .single()

  if (!vendor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const finalPrice = body.base_price ?? item.base_price

  // Price cap: GoCart price must not exceed in-store price by more than 5 %
  if (body.in_store_price_kobo != null && body.in_store_price_kobo > 0) {
    const cap = Math.round(body.in_store_price_kobo * 1.05)
    if (finalPrice > cap) {
      return NextResponse.json(
        { error: 'GoCart price may not exceed in-store price by more than 5 %.', code: 'PRICE_CAP' },
        { status: 422 }
      )
    }
  }

  // Banned word check → auto-flag
  const combined = `${body.name} ${body.description ?? ''}`
  const bannedWord = findBannedWord(combined)

  const updates: Record<string, unknown> = {
    name: body.name,
    description: body.description,
    category_id: body.category_id,
    pack_size: body.pack_size,
    in_store_price_kobo: body.in_store_price_kobo,
    status: bannedWord ? 'in_review' : 'live',
    flag_reason: bannedWord ? 'banned_word' : null,
  }
  if (body.base_price != null) updates.base_price = body.base_price
  if (body.photo_url != null) updates.photo_url = body.photo_url

  const { error } = await admin
    .from('menu_items')
    .update(updates)
    .eq('id', params.itemId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, flagged: !!bannedWord })
}
