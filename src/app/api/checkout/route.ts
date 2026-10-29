import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseServiceFeeSettings, calcServiceFee } from '@/lib/serviceFee'
import type { Cart, CartItem } from '@/types/database'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const admin = createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const { cart, customerAreaId, landmark, details, phone }: {
      cart: Cart
      customerAreaId: string
      landmark: string
      details: string | null
      phone: string
    } = body

    if (!cart || !cart.items.length) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    // 1. Load customer area → zone
    const { data: customerArea, error: areaErr } = await admin
      .from('areas')
      .select('id, name, zone_id, status, gate_pickup')
      .eq('id', customerAreaId)
      .eq('status', 'active')
      .single()

    if (areaErr || !customerArea || !customerArea.zone_id) {
      return NextResponse.json({ error: 'Area not found or not yet serviceable' }, { status: 400 })
    }

    const customerZoneId = customerArea.zone_id

    const { data: customerZone, error: zoneErr } = await admin
      .from('zones')
      .select('id, name, is_active')
      .eq('id', customerZoneId)
      .eq('is_active', true)
      .single()

    if (zoneErr || !customerZone) {
      return NextResponse.json({ error: 'Zone not found or inactive' }, { status: 400 })
    }

    // 2. Load vendor (must be open, with zone_id)
    const { data: vendor, error: vendorErr } = await admin
      .from('vendors')
      .select('*')
      .eq('id', cart.vendorId)
      .eq('is_open', true)
      .single()

    if (vendorErr || !vendor) {
      return NextResponse.json({ error: 'Vendor is not currently available' }, { status: 400 })
    }

    // 3. Recompute prices from DB
    const itemIds = cart.items.map((ci: CartItem) => ci.item.id)
    const { data: dbItems } = await admin
      .from('menu_items')
      .select('id, base_price, is_available')
      .in('id', itemIds)
      .eq('vendor_id', vendor.id)

    if (!dbItems || dbItems.length !== itemIds.length) {
      return NextResponse.json({ error: 'Some items are no longer available' }, { status: 400 })
    }

    const itemPriceMap = Object.fromEntries(
      dbItems.map((i: { id: string; base_price: number; is_available: boolean }) => [i.id, i])
    )

    const allOptionIds = cart.items
      .flatMap((ci: CartItem) => ci.selectedOptions.flatMap(s => s.options.map(o => o.id)))
    const { data: dbOptions } = allOptionIds.length > 0
      ? await admin.from('options').select('id, price_delta, is_available').in('id', allOptionIds)
      : { data: [] }

    const optionPriceMap = Object.fromEntries(
      (dbOptions ?? []).map((o: { id: string; price_delta: number; is_available: boolean }) => [o.id, o])
    )

    let subtotal = 0
    const orderItems = []

    for (const ci of cart.items) {
      const dbItem = itemPriceMap[ci.item.id]
      if (!dbItem?.is_available) {
        return NextResponse.json({ error: `"${ci.item.name}" is no longer available` }, { status: 400 })
      }

      let unitPrice = dbItem.base_price
      const optionsSnapshot = []

      for (const sel of ci.selectedOptions) {
        for (const opt of sel.options) {
          const dbOpt = optionPriceMap[opt.id]
          if (!dbOpt?.is_available) {
            return NextResponse.json({ error: `Option "${opt.name}" is no longer available` }, { status: 400 })
          }
          unitPrice += dbOpt.price_delta
          optionsSnapshot.push({
            group_name: sel.group.name,
            option_name: opt.name,
            price_delta: dbOpt.price_delta,
          })
        }
      }

      const lineTotal = unitPrice * ci.qty
      subtotal += lineTotal
      orderItems.push({
        item_id: ci.item.id,
        name_snapshot: ci.item.name,
        unit_price: unitPrice,
        qty: ci.qty,
        options_snapshot: optionsSnapshot,
        line_total: lineTotal,
      })
    }

    // 4. Load service fee settings
    const { data: feeRows } = await admin
      .from('app_settings')
      .select('key, value')
      .in('key', [
        'service_fee_enabled', 'service_fee_type', 'service_fee_percent',
        'service_fee_min', 'service_fee_max', 'service_fee_flat',
      ])
    const feeSettings = parseServiceFeeSettings(feeRows ?? [])

    // 5. Look up delivery fee via fare level
    let deliveryFee = 0
    let riderPay = 0

    if (vendor.zone_id) {
      const [pairA, pairB] = [vendor.zone_id, customerZoneId].sort()
      const { data: fare } = await admin
        .from('zone_fares')
        .select('fare_level_id, is_serviceable, fare_levels(rider_pay, delivery_fee)')
        .eq('zone_a', pairA)
        .eq('zone_b', pairB)
        .maybeSingle()

      if (fare?.fare_levels) {
        const level = (Array.isArray(fare.fare_levels) ? fare.fare_levels[0] : fare.fare_levels) as { rider_pay: number; delivery_fee: number }
        if (level) { deliveryFee = level.delivery_fee; riderPay = level.rider_pay }
      }
    }

    const serviceFee = calcServiceFee(subtotal, feeSettings)
    const total = subtotal + deliveryFee + serviceFee
    const commissionAmount = Math.round(subtotal * vendor.commission_rate)

    // 6. Generate delivery PIN
    const deliveryPin = String(Math.floor(1000 + Math.random() * 9000))

    // 7. Generate order code
    const { data: orderCode, error: codeErr } = await admin.rpc('generate_order_code').single()
    if (codeErr || !orderCode) {
      console.error('generate_order_code failed:', codeErr)
      return NextResponse.json({ error: 'Failed to generate order code' }, { status: 500 })
    }

    // 8. Create order
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .insert({
        customer_id: user.id,
        vendor_id: vendor.id,
        zone_id: customerZoneId,
        area_id: customerArea.id,
        area_name: customerArea.name,
        is_gate_pickup: customerArea.gate_pickup ?? false,
        address_zone: customerZone.name,
        address_landmark: landmark,
        address_details: details,
        address_phone: phone,
        status: 'pending_payment',
        subtotal,
        delivery_fee: deliveryFee,
        service_fee: serviceFee,
        total,
        commission_amount: commissionAmount,
        rider_pay: riderPay,
        delivery_pin: deliveryPin,
        code: orderCode,
      })
      .select()
      .single()

    if (orderErr || !order) {
      console.error('Order create error:', orderErr)
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }

    // 9. Insert order items
    await admin.from('order_items').insert(
      orderItems.map(oi => ({ ...oi, order_id: order.id }))
    )

    // 10. Log initial event
    await admin.from('order_events').insert({
      order_id: order.id,
      from_status: null,
      to_status: 'pending_payment',
      actor_id: user.id,
      note: 'Order created',
    })

    // 11. Init Monnify payment
    const reference = `DT-${order.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`

    await admin.from('payments').insert({
      order_id: order.id,
      reference,
      provider: 'monnify',
      amount: total,
      status: 'pending',
    })

    const monnifyRes = await initMonnifyTransaction({
      reference,
      orderId: order.id,
      amount: total / 100, // Monnify uses naira
      orderCode: order.code,
      customerPhone: phone,
    })

    if (!monnifyRes.checkoutUrl) {
      return NextResponse.json({ error: 'Payment initialisation failed' }, { status: 500 })
    }

    return NextResponse.json({
      orderId: order.id,
      orderCode: order.code,
      checkoutUrl: monnifyRes.checkoutUrl,
    })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function initMonnifyTransaction({
  reference,
  orderId,
  amount,
  orderCode,
  customerPhone,
}: {
  reference: string
  orderId: string
  amount: number
  orderCode: string
  customerPhone: string
}) {
  const apiKey = process.env.MONNIFY_API_KEY!
  const secretKey = process.env.MONNIFY_SECRET_KEY!
  const contractCode = process.env.MONNIFY_CONTRACT_CODE!
  const baseUrl = process.env.MONNIFY_BASE_URL!

  const authToken = Buffer.from(`${apiKey}:${secretKey}`).toString('base64')
  const tokenRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!tokenRes.ok) {
    console.error('Monnify auth failed:', await tokenRes.text())
    return { checkoutUrl: null }
  }

  const { responseBody: { accessToken } } = await tokenRes.json()

  const txRes = await fetch(`${baseUrl}/api/v1/merchant/transactions/init-transaction`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      customerName: 'Customer',
      customerEmail: `${customerPhone.replace(/\D/g, '')}@dart.app`,
      paymentDescription: `Dart Order ${orderCode}`,
      paymentReference: reference,
      currencyCode: 'NGN',
      contractCode,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/track/${orderId}?confirm=1`,
      paymentMethods: ['CARD', 'ACCOUNT_TRANSFER', 'USSD'],
    }),
  })

  if (!txRes.ok) {
    console.error('Monnify tx init failed:', await txRes.text())
    return { checkoutUrl: null }
  }

  const { responseBody: { checkoutUrl } } = await txRes.json()
  return { checkoutUrl }
}
