'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui/Logo'

const NAV = [
  {
    group: 'Operations',
    items: [
      { href: '/admin', label: 'Live', exact: true },
      { href: '/admin/dispatch', label: 'Dispatch' },
      { href: '/admin/riders', label: 'Riders' },
    ],
  },
  {
    group: 'Catalogue',
    items: [
      { href: '/admin/vendors', label: 'Vendors' },
      { href: '/admin/review', label: 'Review' },
      { href: '/admin/applications', label: 'Applications' },
    ],
  },
  {
    group: 'Finance',
    items: [
      { href: '/admin/money', label: 'Money' },
      { href: '/admin/fees', label: 'Fees' },
      { href: '/admin/metrics', label: 'Metrics' },
    ],
  },
  {
    group: 'Config',
    items: [
      { href: '/admin/areas', label: 'Areas' },
      { href: '/admin/prices', label: 'Pricing' },
      { href: '/admin/users', label: 'Users' },
    ],
  },
  {
    group: 'Help',
    items: [
      { href: '/admin/support', label: 'Support' },
    ],
  },
]

function NavContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Logo */}
      <div className="px-5 py-5 shrink-0">
        <Logo height={28} />
        <p className="text-[11px] text-ink-2 font-medium mt-1">Admin Console</p>
      </div>

      <div className="h-px bg-line mx-4 shrink-0" />

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-hide">
        {NAV.map(({ group, items }) => (
          <div key={group} className="mb-5">
            <p className="text-[10px] font-bold text-ink-2/60 uppercase tracking-[0.1em] px-2 mb-1">
              {group}
            </p>
            {items.map(item => {
              const active = isActive(item.href, item.exact)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onLinkClick}
                  className={`flex items-center h-9 px-3 rounded-xl text-[13.5px] font-medium no-underline mb-0.5 transition-colors ${
                    active
                      ? 'bg-brand-tint text-brand-ink font-semibold'
                      : 'text-ink-2 hover:bg-surface hover:text-ink'
                  }`}
                >
                  {active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand mr-2 flex-none" />
                  )}
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Sign out */}
      <div className="px-3 pb-5 pt-3 border-t border-line shrink-0">
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-2.5 w-full h-9 px-3 rounded-xl text-[13.5px] font-medium text-ink-2 hover:bg-surface hover:text-ink transition-colors"
        >
          <LogOut size={15} strokeWidth={2} />
          Sign out
        </button>
      </div>
    </div>
  )
}

export function AdminSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop — fixed sidebar */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-[220px] bg-white border-r border-line z-30">
        <NavContent />
      </aside>

      {/* Mobile — top bar with hamburger */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 bg-white border-b border-line flex items-center justify-between px-4 h-14">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-10 h-10 flex items-center justify-center -ml-2 rounded-xl hover:bg-surface"
          aria-label="Open menu"
        >
          <Menu size={20} strokeWidth={2} />
        </button>
        <Logo height={24} />
        <div className="w-10" />
      </div>

      {/* Mobile — overlay */}
      {open && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/40 z-40"
            onClick={() => setOpen(false)}
          />
          <aside className="lg:hidden fixed inset-y-0 left-0 w-[260px] bg-white z-50 flex flex-col shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-4 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-surface"
              aria-label="Close menu"
            >
              <X size={15} />
            </button>
            <NavContent onLinkClick={() => setOpen(false)} />
          </aside>
        </>
      )}
    </>
  )
}
