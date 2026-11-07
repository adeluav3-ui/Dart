import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseServiceFeeSettings, calcServiceFee } from '@/lib/serviceFee'
import { getRoadDistance } from '@/lib/server/getRoadDistance'
import { calcDeliveryPrice, type DeliveryPricingSettings } from '@/lib/pricing/delivery'
import { findCoveringArea } from '@/lib/coverageCircles'
import type { Cart, CartItem, Area } from '@/types/database'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const admin = createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const {
      cart,
      areaId,     // string | null — null for custom map pin
      pinLat,
      pinLng,
      landmark,
      details,
      phone,
    }: {
      cart: Cart
      areaId: string | null
      pinLat: number
      pinLng: number
      landmark: string
      details: string | null
      phone: string
    } = body

    if (!cart || !cart.items.length) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    if (pinLat == null || pinLng == null) {
      return NextResponse.json({ error: 'Delivery pin required', code: 'PIN_MISSING' }, { status: 400 })
    }

    // 1. Load customer area (optional — only for gate pickup and zone recording)
    let customerArea: { id: string; name: string; zone_id: string | null; gate_pickup: boolean } | null = null
    let customerZone: { id: string; name: string } | null = null

    if (areaId) {
      const { data: area } = await admin
        .from('areas')
        .select('id, name, zone_id, gate_pickup')
        .eq('id', areaId)
        .eq('status', 'active')
        .single()
      customerArea = area

      if (area?.zone_id) {
        const { data: zone } = await admin
          .from('zones')
          .select('id, name')
          .eq('id', area.zone_id)
          .eq('is_active', true)
          .single()
        customerZone = zone
      }
    }

    // 2. Load vendor (must be open and have a lat/lng)
    const { data: vendor, error: vendorErr } = await admin
      .from('vendors')
      .select('*')
      .eq('id', cart.vendorId)
      .eq('is_open', true)
      .single()

    if (vendorErr || !vendor) {
      return NextResponse.json({ error: 'Vendor is not currently available' }, { status: 400 })
    }

    if (vendor.lat == null || vendor.lng == null) {
      return NextResponse.json({ error: 'Vendor location not configured — cannot accept orders yet', code: 'VENDOR_LOCATION_MISSING' }, { status: 400 })
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

    // 4. Load service fee, delivery pricing settings, and active areas for coverage check
    const [{ data: feeRows }, { data: pricingSettings }, { data: areaRows }] = await Promise.all([
      admin.from('app_settings').select('key, value').in('key', [
        'service_fee_enabled', 'service_fee_type', 'service_fee_percent',
        'service_fee_min', 'service_fee_max', 'service_fee_flat',
      ]),
      admin.from('delivery_pricing_settings').select('*').eq('id', 1).single(),
      admin.from('areas').select('*').eq('is_active', true).eq('status', 'active'),
    ])

    // Coverage check using circle-based areas
    const areas = (areaRows ?? []) as Area[]
    if (areas.length > 0) {
      const covering = findCoveringArea(pinLat, pinLng, areas)
      if (!covering) {
        return NextResponse.json({ error: 'Delivery spot is outside our coverage area', code: 'OUTSIDE_COVERAGE' }, { status: 400 })
      }
    }

    if (!pricingSettings) {
      return NextResponse.json({ error: 'Pricing settings not configured' }, { status: 500 })
    }

    const feeSettings = parseServiceFeeSettings(feeRows ?? [])

    // 5. Compute delivery price via road distance
    const { distance_m, source } = await getRoadDistance(
      vendor.lat, vendor.lng, pinLat, pinLng
    )

    const settings = pricingSettings as DeliveryPricingSettings
    if (distance_m > settings.max_distance_m) {
      return NextResponse.json({ error: 'Delivery spot is too far from the vendor' }, { status: 400 })
    }

    const { okada_fare, rider_pay, delivery_fee: platformDeliveryCost } = calcDeliveryPrice(distance_m, settings)

    const serviceFee = calcServiceFee(subtotal, feeSettings)
    const total = subtotal + okada_fare + serviceFee
    const commissionAmount = Math.round(subtotal * vendor.commission_rate)

    // 6. Generate delivery PIN and order code
    const deliveryPin = String(Math.floor(1000 + Math.random() * 9000))
    const { data: orderCode, error: codeErr } = await admin.rpc('generate_order_code').single()
    if (codeErr || !orderCode) {
      console.error('generate_order_code failed:', codeErr)
      return NextResponse.json({ error: 'Failed to generate order code' }, { status: 500 })
    }

    // 7. Create order with snapshot columns
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .insert({
        customer_id: user.id,
        vendor_id: vendor.id,
        zone_id: customerZone?.id ?? null,
        area_id: customerArea?.id ?? null,
        area_name: customerArea?.name ?? null,
        is_gate_pickup: customerArea?.gate_pickup ?? false,
        address_zone: customerZone?.name ?? 'Custom location',
        address_landmark: landmark,
        address_details: details,
        address_phone: phone,
        status: 'pending_payment',
        subtotal,
        delivery_fee: okada_fare,   // what customer pays (existing column)
        service_fee: serviceFee,
        total,
        commission_amount: commissionAmount,
        rider_pay: rider_pay,       // existing column = rider_pay (okada_fare + extra)
        delivery_pin: deliveryPin,
        code: orderCode,
        // New snapshot columns
        pin_lat: pinLat,
        pin_lng: pinLng,
        distance_m,
        distance_source: source,
        okada_fare_kobo: okada_fare,
        rider_pay_kobo: rider_pay,
        delivery_fee_kobo: platformDeliveryCost,
        pricing_snapshot: {
          base_fare_kobo: settings.base_fare_kobo,
          per_km_kobo: settings.per_km_kobo,
          min_fare_kobo: settings.min_fare_kobo,
          round_to_kobo: settings.round_to_kobo,
          rider_extra_kobo: settings.rider_extra_kobo,
          gocart_extra_kobo: settings.gocart_extra_kobo,
          distance_m,
          source,
          computed_at: new Date().toISOString(),
        },
      })
      .select()
      .single()

    if (orderErr || !order) {
      console.error('Order create error:', orderErr)
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }

    // 8. Insert order items
    await admin.from('order_items').insert(
      orderItems.map(oi => ({ ...oi, order_id: order.id }))
    )

    // 9. Log initial event
    await admin.from('order_events').insert({
      order_id: order.id,
      from_status: null,
      to_status: 'pending_payment',
      actor_id: user.id,
      note: 'Order created',
    })

    // 10. Init Monnify payment
    const reference = `GC-${order.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`

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
      amount: total / 100,
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

// In-process Monnify token cache — one auth call is reused across all concurrent
// requests until the token is 60 s from expiry, then lazily refreshed.
let _monnifyCache: { token: string; expiresAt: number } | null = null

async function getMonnifyToken(baseUrl: string, apiKey: string, secretKey: string): Promise<string | null> {
  if (_monnifyCache && _monnifyCache.expiresAt > Date.now() + 60_000) {
    return _monnifyCache.token
  }

  const encoded = Buffer.from(`${apiKey}:${secretKey}`).toString('base64')
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    console.error('Monnify auth failed:', await res.text())
    return null
  }

  const { responseBody } = await res.json()
  _monnifyCache = {
    token: responseBody.accessToken,
    // expiresIn is in seconds; default to 1 h if absent
    expiresAt: Date.now() + (responseBody.expiresIn ?? 3600) * 1000,
  }
  return _monnifyCache.token
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

  const accessToken = await getMonnifyToken(baseUrl, apiKey, secretKey)
  if (!accessToken) return { checkoutUrl: null }

  const txRes = await fetch(`${baseUrl}/api/v1/merchant/transactions/init-transaction`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      customerName: 'Customer',
      customerEmail: `${customerPhone.replace(/\D/g, '')}@gocart.app`,
      paymentDescription: `GoCart Order ${orderCode}`,
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
