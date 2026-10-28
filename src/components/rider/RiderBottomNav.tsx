'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function RiderBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-line grid grid-cols-3"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)', height: 'calc(64px + env(safe-area-inset-bottom))' }}
    >
      <Link href="/rider/jobs" className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium no-underline transition-colors ${pathname.startsWith('/rider/jobs') ? 'text-brand font-bold' : 'text-ink-2'}`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/>
          <path d="M8.5 17.5h7M15 6l2 5H9l1-4h4"/>
          <path d="M10 6V4"/>
        </svg>
        Jobs
      </Link>
      <Link href="/rider/earnings" className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium no-underline transition-colors ${pathname.startsWith('/rider/earnings') ? 'text-brand font-bold' : 'text-ink-2'}`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/>
        </svg>
        Earnings
      </Link>
      <Link href="/rider/profile" className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium no-underline transition-colors ${pathname.startsWith('/rider/profile') ? 'text-brand font-bold' : 'text-ink-2'}`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
        Profile
      </Link>
    </nav>
  )
}
