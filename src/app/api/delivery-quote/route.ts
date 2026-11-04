import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRoadDistance } from '@/lib/server/getRoadDistance'
import { calcDeliveryPrice, type DeliveryPricingSettings } from '@/lib/pricing/delivery'

export async function POST(req: NextRequest) {
  try {
    const { vendorId, pinLat, pinLng } = await req.json()

    if (!vendorId || pinLat == null || pinLng == null) {
      return NextResponse.json({ error: 'vendorId, pinLat, pinLng required' }, { status: 400 })
    }

    const admin = createAdminClient()

    const [{ data: vendor }, { data: settings }] = await Promise.all([
      admin.from('vendors').select('lat, lng, name').eq('id', vendorId).single(),
      admin.from('delivery_pricing_settings').select('*').eq('id', 1).single(),
    ])

    if (!vendor?.lat || !vendor?.lng) {
      return NextResponse.json({ error: 'Vendor location not set' }, { status: 400 })
    }

    if (!settings) {
      return NextResponse.json({ error: 'Pricing settings not found' }, { status: 500 })
    }

    const { distance_m, source } = await getRoadDistance(
      vendor.lat, vendor.lng, pinLat, pinLng
    )

    const { okada_fare, rider_pay, delivery_fee } = calcDeliveryPrice(
      distance_m,
      settings as DeliveryPricingSettings
    )

    return NextResponse.json({
      delivery_fee: okada_fare, // what the customer pays (shown in UI as "Delivery fee")
      okada_fare,
      rider_pay,
      platform_delivery_cost: delivery_fee,
      distance_m,
      source,
      too_far: distance_m > settings.max_distance_m,
      vendor_name: vendor.name,
    })
  } catch (err) {
    console.error('delivery-quote error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
