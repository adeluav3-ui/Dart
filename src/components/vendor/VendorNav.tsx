'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Props {
  newOrderCount?: number
}

const NAV = [
  {
    href: '/vendor/orders',
    label: 'Orders',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M7 4h10a1 1 0 0 1 1 1v15l-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1z" />
      </svg>
    ),
  },
  {
    href: '/vendor/menu',
    label: 'Menu',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M5 6h14M5 12h14M5 18h9" />
      </svg>
    ),
  },
  {
    href: '/vendor/earnings',
    label: 'Earnings',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10h18" />
      </svg>
    ),
  },
  {
    href: '/vendor/shop',
    label: 'Shop',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M3 9l1-5h16l1 5" />
        <path d="M21 9H3v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9z" />
        <path d="M9 9v4a3 3 0 0 0 6 0V9" />
      </svg>
    ),
  },
]

export function VendorNav({ newOrderCount }: Props) {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[72px] px-3 pb-3.5 pt-2 bg-white border-t border-line grid grid-cols-4">
      {NAV.map(item => {
        const active = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex flex-col items-center justify-center gap-1 text-xs font-medium no-underline transition-colors ${
              active ? 'font-bold text-brand' : 'text-ink-2'
            }`}
          >
            {item.icon}
            {item.label}
            {item.href === '/vendor/orders' && newOrderCount != null && newOrderCount > 0 && (
              <span className="absolute top-0 right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-warn text-white text-[10px] font-bold flex items-center justify-center">
                {newOrderCount}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
