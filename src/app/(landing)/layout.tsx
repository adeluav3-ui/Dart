'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { X, Menu } from 'lucide-react'

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#categories', label: 'Shops' },
  { href: '#areas', label: 'Areas' },
  { href: '#faq', label: 'FAQ' },
  { href: '/sell', label: 'Sell on GoCart' },
]

function LandingNav() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-line">
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="shrink-0" onClick={() => setOpen(false)}>
          <Image src="/brand/gocart-logo.svg" alt="GoCart" width={100} height={28} priority />
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-6 text-sm font-semibold text-ink-2">
          {NAV_LINKS.map(l => (
            <li key={l.href}>
              <a href={l.href} className="hover:text-ink transition-colors">{l.label}</a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link
            href="/start"
            className="h-10 px-5 rounded-2xl bg-brand text-white text-sm font-bold flex items-center hover:bg-brand-dark transition-colors"
          >
            Order now
          </Link>

          {/* Hamburger button — mobile only */}
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl text-ink hover:bg-surface transition-colors"
            onClick={() => setOpen(v => !v)}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t border-line bg-white">
          <ul className="px-4 py-3 flex flex-col">
            {NAV_LINKS.map(l => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center h-12 text-base font-semibold text-ink hover:text-brand transition-colors"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  )
}

function LandingFooter() {
  return (
    <footer className="bg-ink text-white/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="sm:col-span-2 lg:col-span-1">
          <Image
            src="/brand/gocart-logo-white.svg"
            alt="GoCart"
            width={100}
            height={28}
            className="mb-3"
          />
          <p className="text-sm leading-relaxed max-w-xs">
            Food, groceries and pharmacy, delivered to your landmark in Sagamu.
          </p>
        </div>

        <div>
          <p className="text-white font-semibold text-sm mb-3">Order</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/start" className="hover:text-white transition-colors">Start ordering</Link></li>
            <li><a href="#areas" className="hover:text-white transition-colors">Delivery areas</a></li>
            <li><a href="#how-it-works" className="hover:text-white transition-colors">How it works</a></li>
          </ul>
        </div>

        <div>
          <p className="text-white font-semibold text-sm mb-3">Business</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/sell" className="hover:text-white transition-colors">Sell on GoCart</Link></li>
            <li><Link href="/ride" className="hover:text-white transition-colors">Ride with GoCart</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-white font-semibold text-sm mb-3">Legal</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/legal/terms" className="hover:text-white transition-colors">Terms of use</Link></li>
            <li><Link href="/legal/privacy" className="hover:text-white transition-colors">Privacy policy</Link></li>
            <li><Link href="/refunds" className="hover:text-white transition-colors">Refund policy</Link></li>
            <li><Link href="/legal/vendor-agreement" className="hover:text-white transition-colors">Vendor agreement</Link></li>
            <li><Link href="/legal/rider-agreement" className="hover:text-white transition-colors">Rider agreement</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/40">
          <span>© {new Date().getFullYear()} GoCart. All rights reserved.</span>
          <span>Sagamu, Ogun State, Nigeria</span>
        </div>
      </div>
    </footer>
  )
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      router.replace('/start')
    }
  }, [router])

  return (
    <>
      <LandingNav />
      <main>{children}</main>
      <LandingFooter />
    </>
  )
}
