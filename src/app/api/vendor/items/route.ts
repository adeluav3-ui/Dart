import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findBannedWord } from '@/lib/bannedWords'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    vendor_id: string
    category_id: string | null
    name: string
    description: string | null
    base_price: number
    pack_size: string | null
    in_store_price_kobo: number | null
    sort_order?: number
  }

  const admin = createAdminClient()

  // Verify caller owns this vendor
  const { data: vendor } = await admin
    .from('vendors')
    .select('id')
    .eq('id', body.vendor_id)
    .eq('owner_id', user.id)
    .single()

  if (!vendor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Price cap: GoCart price must not exceed in-store price by more than 5 %
  if (body.in_store_price_kobo != null && body.in_store_price_kobo > 0) {
    const cap = Math.round(body.in_store_price_kobo * 1.05)
    if (body.base_price > cap) {
      return NextResponse.json(
        { error: 'GoCart price may not exceed in-store price by more than 5 %.', code: 'PRICE_CAP' },
        { status: 422 }
      )
    }
  }

  // Banned word check → auto-flag
  const combined = `${body.name} ${body.description ?? ''}`
  const bannedWord = findBannedWord(combined)
  const status = bannedWord ? 'in_review' : 'live'
  const flag_reason = bannedWord ? 'banned_word' : null

  const { data: item, error } = await admin
    .from('menu_items')
    .insert({
      vendor_id: body.vendor_id,
      category_id: body.category_id,
      name: body.name,
      description: body.description,
      base_price: body.base_price,
      pack_size: body.pack_size,
      in_store_price_kobo: body.in_store_price_kobo,
      sort_order: body.sort_order ?? 0,
      is_available: true,
      status,
      flag_reason,
    })
    .select()
    .single()

  if (error || !item) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create item' }, { status: 500 })
  }

  return NextResponse.json({ item, flagged: !!bannedWord })
}
