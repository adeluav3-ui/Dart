import type { Metadata } from 'next'
import Link from 'next/link'
import { createServerClient } from '@supabase/ssr'
import { notFound } from 'next/navigation'
import { MapPin, ChevronRight } from 'lucide-react'

export const revalidate = 3600

// Cookieless client — safe to use during static generation (no request context)
function createPublicClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

type Props = { params: { slug: string } }

async function getArea(slug: string) {
  const supabase = createPublicClient()
  const { data: areas } = await supabase
    .from('areas')
    .select('id, name, status')
    .eq('status', 'active')

  return (areas ?? []).find(a => toSlug(a.name) === slug) ?? null
}

export async function generateStaticParams() {
  try {
    const supabase = createPublicClient()
    const { data: areas } = await supabase
      .from('areas')
      .select('name')
      .eq('status', 'active')

    return (areas ?? []).map(a => ({ slug: toSlug(a.name) }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const area = await getArea(params.slug)
  if (!area) return {}

  return {
    title: `Food & Grocery Delivery in ${area.name}, Sagamu`,
    description: `GoCart delivers food from restaurants, groceries from supermarkets and medicines from pharmacies to ${area.name} in Sagamu, Ogun State. Order now.`,
    alternates: { canonical: `https://gocart.app/delivery/${params.slug}` },
    openGraph: {
      title: `GoCart delivers to ${area.name}, Sagamu`,
      description: `Order food, groceries and pharmacy items delivered to ${area.name} in Sagamu.`,
    },
  }
}

export default async function DeliveryAreaPage({ params }: Props) {
  const area = await getArea(params.slug)
  if (!area) notFound()

  const areaSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `GoCart Delivery — ${area.name}`,
    provider: { '@type': 'Organization', name: 'GoCart', url: 'https://gocart.app' },
    serviceType: 'Local Delivery',
    areaServed: { '@type': 'Place', name: `${area.name}, Sagamu, Ogun State, Nigeria` },
    description: `On-demand delivery of food, groceries and pharmacy items to ${area.name} in Sagamu.`,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(areaSchema) }}
      />

      <section className="bg-white py-16 lg:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="inline-flex items-center gap-1.5 bg-brand-tint text-brand-ink text-xs font-bold px-3 py-1.5 rounded-full mb-6">
            <MapPin className="w-3.5 h-3.5" />
            Sagamu, Ogun State
          </div>

          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-ink leading-tight mb-4">
            Food and grocery delivery in {area.name}
          </h1>

          <p className="text-ink-2 text-base sm:text-lg leading-relaxed mb-8">
            GoCart delivers food from restaurants, groceries from supermarkets and medicines from pharmacies
            to {area.name} in Sagamu, Ogun State. Order now and a rider brings it to your landmark.
          </p>

          <Link
            href="/start"
            className="inline-flex items-center gap-2 h-14 px-7 rounded-2xl bg-brand text-white font-bold text-base hover:bg-brand-dark transition-colors"
          >
            Order to {area.name} <ChevronRight className="w-5 h-5" />
          </Link>

          <div className="mt-12 pt-8 border-t border-line">
            <Link href="/#areas" className="text-brand text-sm font-semibold hover:underline">
              ← View all delivery areas
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
