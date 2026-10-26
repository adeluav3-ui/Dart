import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Load original order items with current prices
  const { data: originalItems } = await supabase
    .from('order_items')
    .select('*, menu_items(base_price, is_available, vendor_id, name)')
    .eq('order_id', params.orderId)

  if (!originalItems || originalItems.length === 0) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Build cart payload with today's prices
  const cartItems = []
  for (const oi of originalItems) {
    const mi = oi.menu_items
    if (!mi?.is_available) continue

    cartItems.push({
      itemId: oi.item_id,
      name: oi.name_snapshot,
      basePrice: mi.base_price,
      qty: oi.qty,
      optionsSnapshot: oi.options_snapshot,
    })
  }

  // Return the cart data to the client — it will populate the cart store
  return NextResponse.json({ cartItems })
}
