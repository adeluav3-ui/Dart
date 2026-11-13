import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { MapPin, Clock, ShieldCheck, RefreshCw, CheckCircle, ChevronRight } from 'lucide-react'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'GoCart — Food, Grocery & Pharmacy Delivery in Sagamu',
  description:
    'Order food from restaurants, groceries from supermarkets, and medicines from pharmacies. Fast delivery anywhere in Sagamu, Ogun State. Near OOUTH? We deliver.',
  alternates: { canonical: 'https://gocart.app' },
  openGraph: {
    title: 'GoCart — Fast Delivery in Sagamu',
    description:
      'Restaurants, supermarkets and pharmacies — delivered to your door in Sagamu, Ogun State.',
    url: 'https://gocart.app',
    siteName: 'GoCart',
    type: 'website',
    locale: 'en_NG',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GoCart — Fast Delivery in Sagamu',
    description: 'Restaurants, supermarkets and pharmacies delivered in Sagamu, Ogun State.',
  },
}

type Area = { id: string; name: string; status: string }

async function getData() {
  try {
    const supabase = createClient()
    const [areasRes, fareRes] = await Promise.all([
      supabase
        .from('areas')
        .select('id, name, status')
        .order('sort_order', { ascending: true }),
      supabase
        .from('fare_levels')
        .select('okada_price')
        .order('okada_price', { ascending: true })
        .limit(1)
        .single(),
    ])
    return {
      areas: (areasRes.data ?? []) as Area[],
      minFareKobo: fareRes.data?.okada_price ?? null,
    }
  } catch {
    return { areas: [], minFareKobo: null }
  }
}

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const TRUST_ITEMS = [
  {
    icon: <CheckCircle className="w-6 h-6 text-brand" strokeWidth={2} />,
    title: 'Real vendor photos',
    desc: 'Every shop and item is verified before going live.',
  },
  {
    icon: <ShieldCheck className="w-6 h-6 text-brand" strokeWidth={2} />,
    title: 'Every fee shown first',
    desc: 'Delivery fee and service charge appear before you pay.',
  },
  {
    icon: <CheckCircle className="w-6 h-6 text-brand" strokeWidth={2} />,
    title: 'PIN-confirmed delivery',
    desc: 'Your 4-digit PIN ensures the rider hands it to you.',
  },
  {
    icon: <RefreshCw className="w-6 h-6 text-brand" strokeWidth={2} />,
    title: 'Instant refunds',
    desc: 'If something goes wrong, you get your money back fast.',
  },
]

const STEPS = [
  { n: '1', title: 'Choose a shop', desc: 'Browse restaurants, supermarkets and pharmacies near you.' },
  { n: '2', title: 'Add to cart', desc: 'Pick your items, customise options, review the total.' },
  { n: '3', title: 'Pay securely', desc: 'Card or bank transfer — Monnify handles your payment.' },
  { n: '4', title: 'Rider brings it', desc: 'Track progress in real time; confirm with your PIN.' },
]

function buildFaqs(activeAreaNames: string[]) {
  const areaList = activeAreaNames.length > 0
    ? activeAreaNames.join(', ')
    : 'several areas in Sagamu'
  return [
    {
      q: 'Where does GoCart deliver in Sagamu?',
      a: `We currently deliver within ${areaList}. More areas are coming soon.`,
    },
  {
    q: 'How long does delivery take?',
    a: 'Most orders arrive within 20–45 minutes depending on the vendor and your location.',
  },
  {
    q: 'How do I confirm my delivery?',
    a: 'When your rider arrives, they will ask for a 4-digit PIN that was sent to you when you placed your order. This makes sure the order goes to the right person.',
  },
  {
    q: 'What payment methods are accepted?',
    a: 'You can pay by debit card or bank transfer. All payments are processed by Monnify and your card details are never stored by GoCart.',
  },
  {
    q: 'What if my order is wrong or does not arrive?',
    a: 'Contact us through the app and we will investigate. If GoCart is at fault, you will receive a full refund. Our refund policy is in the app and on this website.',
  },
  {
    q: 'Can I order from a pharmacy for prescription medicine?',
    a: 'Not in the current version. GoCart pharmacies sell over-the-counter products only.',
  },
  ]
}

export default async function LandingPage() {
  const { areas, minFareKobo } = await getData()
  const activeAreas = areas.filter(a => a.status === 'active')
  const comingSoon = areas.filter(a => a.status === 'coming_soon')

  const FAQS = buildFaqs(activeAreas.map(a => a.name))

  const JSON_LD = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://gocart.app/#org',
        name: 'GoCart',
        url: 'https://gocart.app',
        logo: 'https://gocart.app/brand/gocart-logo.svg',
        contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', availableLanguage: 'en' },
      },
      {
        '@type': 'WebSite',
        '@id': 'https://gocart.app/#website',
        url: 'https://gocart.app',
        name: 'GoCart',
        publisher: { '@id': 'https://gocart.app/#org' },
      },
      {
        '@type': 'LocalBusiness',
        '@id': 'https://gocart.app/#local',
        name: 'GoCart',
        description: 'Food, grocery and pharmacy delivery in Sagamu, Ogun State, Nigeria.',
        url: 'https://gocart.app',
        image: 'https://gocart.app/brand/gocart-logo.svg',
        priceRange: '₦',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Sagamu',
          addressRegion: 'Ogun State',
          addressCountry: 'NG',
        },
        areaServed: {
          '@type': 'City',
          name: 'Sagamu',
          containedInPlace: { '@type': 'State', name: 'Ogun State' },
        },
      },
      {
        '@type': 'Service',
        '@id': 'https://gocart.app/#service',
        name: 'GoCart Delivery',
        provider: { '@id': 'https://gocart.app/#org' },
        serviceType: 'Local Delivery',
        areaServed: { '@type': 'City', name: 'Sagamu' },
        description: 'On-demand delivery of food, groceries and pharmacy items in Sagamu, Ogun State.',
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQS.map(faq => ({
          '@type': 'Question',
          name: faq.q,
          acceptedAnswer: { '@type': 'Answer', text: faq.a },
        })),
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      {/* ── Hero ── */}
      <section aria-labelledby="hero-heading" className="bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 lg:py-20 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Text */}
          <div className="order-2 lg:order-1">
            <span className="inline-flex items-center gap-1.5 bg-brand-tint text-brand-ink text-xs font-bold px-3 py-1.5 rounded-full mb-5">
              <MapPin className="w-3.5 h-3.5" />
              Now delivering in Sagamu, Ogun State
            </span>
            <h1
              id="hero-heading"
              className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-ink leading-[1.1] tracking-tight mb-4"
            >
              Food, groceries and pharmacy delivery in Sagamu
            </h1>
            <p className="text-ink-2 text-base sm:text-lg leading-relaxed mb-8 max-w-lg">
              Order from restaurants, supermarkets and pharmacies near you. GoCart brings it to your landmark — fast.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Link
                href="/start"
                className="h-14 px-7 rounded-2xl bg-brand text-white font-bold text-base flex items-center justify-center hover:bg-brand-dark transition-colors"
              >
                Start ordering
              </Link>
              <Link
                href="/sell"
                className="h-14 px-7 rounded-2xl border-2 border-line text-ink font-bold text-base flex items-center justify-center hover:border-ink-2 transition-colors"
              >
                List your shop
              </Link>
            </div>

            {/* Area chips */}
            <div className="flex flex-wrap gap-2">
              {activeAreas.map(a => (
                <Link
                  key={a.id}
                  href={`/delivery/${toSlug(a.name)}`}
                  className="inline-flex items-center gap-1 bg-surface text-ink text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-line transition-colors"
                >
                  <MapPin className="w-3 h-3 text-ink-2" />
                  {a.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Hero image */}
          <div className="order-1 lg:order-2 relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-photo">
            <Image
              src="/images/landing/gocart-food-delivery-sagamu-hero-opt.jpg"
              alt="GoCart rider delivering food in Sagamu"
              fill
              priority
              fetchPriority="high"
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* ── Trust strip ── */}
      <section aria-label="Why GoCart" className="bg-brand-tint border-y border-brand/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {TRUST_ITEMS.map(item => (
              <div key={item.title} className="flex flex-col gap-2">
                {item.icon}
                <p className="font-bold text-sm text-ink">{item.title}</p>
                <p className="text-xs text-ink-2 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Categories ── */}
      <section id="categories" aria-labelledby="cat-heading" className="bg-white py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2
            id="cat-heading"
            className="font-heading font-extrabold text-2xl sm:text-3xl text-ink mb-2"
          >
            Order from any shop in Sagamu
          </h2>
          <p className="text-ink-2 mb-8">Restaurants, supermarkets and pharmacies — all in one app.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                title: 'Restaurants and bukas',
                desc: 'Jollof rice, pepper soup, shawarma, and more — from local restaurants near you.',
                img: '/images/landing/jollof-rice-delivery-sagamu.jpg',
                alt: 'Jollof rice food delivery in Sagamu',
              },
              {
                title: 'Supermarkets and provisions',
                desc: 'Groceries, drinks, household items and snacks delivered from stores near you.',
                img: '/images/landing/grocery-delivery-sagamu-opt.jpg',
                alt: 'Grocery delivery in Sagamu',
              },
              {
                title: 'Pharmacies',
                desc: 'Over-the-counter medicines, vitamins and personal care from trusted pharmacies.',
                img: '/images/landing/pharmacy-delivery-sagamu.jpg',
                alt: 'Pharmacy delivery in Sagamu',
              },
            ].map(cat => (
              <Link key={cat.title} href="/start" className="group rounded-2xl overflow-hidden border border-line hover:border-brand/40 hover:shadow-md transition-all">
                <div className="relative w-full aspect-[4/3] bg-photo">
                  <Image
                    src={cat.img}
                    alt={cat.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-heading font-bold text-base text-ink mb-1">{cat.title}</h3>
                  <p className="text-xs text-ink-2 leading-relaxed">{cat.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" aria-labelledby="how-heading" className="bg-canvas py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2
            id="how-heading"
            className="font-heading font-extrabold text-2xl sm:text-3xl text-ink mb-2"
          >
            How GoCart works
          </h2>
          <p className="text-ink-2 mb-10">Four steps from hungry to happy.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map(step => (
              <div key={step.n} className="flex flex-col gap-3">
                <div className="w-10 h-10 rounded-full bg-brand text-white font-heading font-extrabold text-lg flex items-center justify-center shrink-0">
                  {step.n}
                </div>
                <h3 className="font-heading font-bold text-base text-ink">{step.title}</h3>
                <p className="text-sm text-ink-2 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Areas ── */}
      <section id="areas" aria-labelledby="areas-heading" className="bg-canvas py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">

          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5 mb-10">
            <div>
              {activeAreas.length > 0 && (
                <span className="inline-flex items-center gap-1.5 bg-brand text-white text-xs font-bold px-3 py-1 rounded-full mb-4">
                  <MapPin className="w-3 h-3" />
                  {activeAreas.length} area{activeAreas.length !== 1 ? 's' : ''} live
                </span>
              )}
              <h2
                id="areas-heading"
                className="font-heading font-extrabold text-2xl sm:text-3xl text-ink mb-2"
              >
                Where we deliver in Sagamu
              </h2>
              <p className="text-ink-2 max-w-md">
                We cover the most active parts of Sagamu and are expanding fast. Tap an area to see what&apos;s available near you.
              </p>
            </div>
            <Link
              href="/start"
              className="shrink-0 self-start h-10 px-5 rounded-2xl bg-brand text-white text-sm font-bold inline-flex items-center gap-1.5 hover:bg-brand-dark transition-colors"
            >
              Order now <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Active areas grid */}
          {activeAreas.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {activeAreas.map(a => (
                <Link
                  key={a.id}
                  href={`/delivery/${toSlug(a.name)}`}
                  className="group flex items-center gap-4 bg-white rounded-2xl p-5 border border-line hover:border-brand/30 hover:shadow-sm transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-brand-tint flex items-center justify-center shrink-0 group-hover:bg-brand transition-colors">
                    <MapPin className="w-5 h-5 text-brand group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[15px] text-ink leading-snug">{a.name}</p>
                    <p className="text-xs text-brand font-medium mt-0.5">Delivering now</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-2 shrink-0 group-hover:text-brand transition-colors" />
                </Link>
              ))}
            </div>
          )}

          {/* Coming soon strip */}
          {comingSoon.length > 0 && (
            <div className="bg-white rounded-2xl border border-line p-5 mb-5">
              <p className="text-[11px] font-bold text-ink-2 uppercase tracking-widest mb-3">Coming soon</p>
              <div className="flex flex-wrap gap-2">
                {comingSoon.map(a => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1.5 bg-surface text-ink-2 text-sm font-medium px-3 py-1.5 rounded-full"
                  >
                    <Clock className="w-3 h-3" />
                    {a.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-sm text-ink-2">
            Don&apos;t see your area?{' '}
            <Link href="/start" className="text-brand font-semibold hover:underline">
              Request it in the app →
            </Link>
          </p>
        </div>
      </section>

      {/* ── Sell + Ride ── */}
      <section aria-label="Partner with GoCart" className="bg-canvas py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Sell */}
          <div className="rounded-2xl overflow-hidden border border-line bg-white">
            <div className="relative w-full aspect-[16/9] bg-photo">
              <Image
                src="/images/landing/sell-on-gocart-vendor.jpg"
                alt="Vendor selling on GoCart in Sagamu"
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <div className="p-6">
              <h2 className="font-heading font-extrabold text-xl text-ink mb-2">Sell on GoCart</h2>
              <p className="text-sm text-ink-2 leading-relaxed mb-5">
                Reach customers in Sagamu without managing your own delivery. We handle riders, payments and refunds — you focus on the food.
              </p>
              <Link
                href="/sell"
                className="inline-flex items-center gap-1.5 h-11 px-5 rounded-2xl bg-brand text-white text-sm font-bold hover:bg-brand-dark transition-colors"
              >
                List your shop <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Ride */}
          <div className="rounded-2xl overflow-hidden border border-line bg-white">
            <div className="relative w-full aspect-[16/9] bg-photo">
              <Image
                src="/images/landing/ride-with-gocart-rider.jpg"
                alt="GoCart delivery rider in Sagamu"
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <div className="p-6">
              <h2 className="font-heading font-extrabold text-xl text-ink mb-2">Ride with GoCart</h2>
              <p className="text-sm text-ink-2 leading-relaxed mb-5">
                Earn money making deliveries in Sagamu on your schedule. Get orders directly on your phone — no middlemen.
              </p>
              <Link
                href="/ride"
                className="inline-flex items-center gap-1.5 h-11 px-5 rounded-2xl border-2 border-ink text-ink text-sm font-bold hover:bg-ink hover:text-white transition-colors"
              >
                Apply to ride <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" aria-labelledby="faq-heading" className="bg-white py-14 lg:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2
            id="faq-heading"
            className="font-heading font-extrabold text-2xl sm:text-3xl text-ink mb-8"
          >
            Frequently asked questions
          </h2>

          <div className="flex flex-col divide-y divide-line">
            {FAQS.map(faq => (
              <div key={faq.q} className="py-5">
                <h3 className="font-bold text-base text-ink mb-2">{faq.q}</h3>
                <p className="text-sm text-ink-2 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section aria-label="Start ordering" className="bg-brand py-16 lg:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-white mb-4 leading-tight">
            Hungry? Out of something?<br className="hidden sm:block" /> GoCart it.
          </h2>
          <p className="text-white/80 text-base sm:text-lg mb-8">
            Order now and get food, groceries or medicine delivered to your landmark in Sagamu.
          </p>
          <Link
            href="/start"
            className="inline-flex items-center gap-2 h-14 px-8 rounded-2xl bg-white text-brand font-bold text-base hover:bg-brand-tint transition-colors"
          >
            Start ordering <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </>
  )
}
