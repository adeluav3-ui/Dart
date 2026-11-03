import Link from 'next/link'
import Image from 'next/image'

function LandingNav() {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-line">
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="shrink-0">
          <Image
            src="/brand/gocart-logo.svg"
            alt="GoCart"
            width={100}
            height={28}
            priority
          />
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-6 text-sm font-semibold text-ink-2">
          <li><a href="#how-it-works" className="hover:text-ink transition-colors">How it works</a></li>
          <li><a href="#categories" className="hover:text-ink transition-colors">Shops</a></li>
          <li><a href="#areas" className="hover:text-ink transition-colors">Areas</a></li>
          <li><a href="#faq" className="hover:text-ink transition-colors">FAQ</a></li>
          <li><Link href="/sell" className="hover:text-ink transition-colors">Sell on GoCart</Link></li>
        </ul>

        <Link
          href="/start"
          className="shrink-0 h-10 px-5 rounded-2xl bg-brand text-white text-sm font-bold flex items-center hover:bg-brand-dark transition-colors"
        >
          Order now
        </Link>
      </nav>
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
            <li><Link href="/terms" className="hover:text-white transition-colors">Terms of service</Link></li>
            <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy policy</Link></li>
            <li><Link href="/refunds" className="hover:text-white transition-colors">Refund policy</Link></li>
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
  return (
    <>
      <LandingNav />
      <main>{children}</main>
      <LandingFooter />
    </>
  )
}
