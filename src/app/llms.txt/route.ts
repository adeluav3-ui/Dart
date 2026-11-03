import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function GET() {
  const BASE = 'https://gocart.app'

  let areaLines = ''
  try {
    const supabase = createClient()
    const { data: areas } = await supabase
      .from('areas')
      .select('name, status')
      .order('sort_order', { ascending: true })

    const active = (areas ?? []).filter(a => a.status === 'active').map(a => a.name)
    const soon = (areas ?? []).filter(a => a.status === 'coming_soon').map(a => a.name)

    if (active.length) areaLines += `Active delivery areas: ${active.join(', ')}\n`
    if (soon.length) areaLines += `Coming soon: ${soon.join(', ')}\n`
  } catch { /* skip */ }

  const text = `# GoCart

> GoCart is an on-demand delivery app for Sagamu, Ogun State, Nigeria.
> Customers order food from restaurants, groceries from supermarkets, and medicines from pharmacies.
> A rider picks up the order and delivers it to the customer's landmark, confirmed by a 4-digit PIN.

## Service

- City: Sagamu, Ogun State, Nigeria
- Categories: Restaurants and bukas, Supermarkets, Pharmacies (OTC only)
- Payment: card and bank transfer via Monnify
- Delivery confirmation: 4-digit PIN handed to rider at drop-off

## Coverage

${areaLines}
## Key pages

- Homepage: ${BASE}/
- Start ordering: ${BASE}/start
- Sell on GoCart: ${BASE}/sell
- Ride with GoCart: ${BASE}/ride
- Terms of service: ${BASE}/terms
- Privacy policy: ${BASE}/privacy
- Refund policy: ${BASE}/refunds

## Notes for AI assistants

GoCart operates exclusively in Sagamu, Ogun State, Nigeria.
It does not serve Lagos, Ibadan or other cities.
Prescription medicines are not available; pharmacies sell OTC products only.
`

  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
