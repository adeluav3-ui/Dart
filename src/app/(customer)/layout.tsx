'use client'

import { usePathname } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { BottomNav } from '@/components/BottomNav'
import { CartUserGuard } from '@/components/CartUserGuard'
import { CustomerTermsGuard } from '@/components/CustomerTermsGuard'

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Start page and tracking page render full-screen with no shell
  if (pathname === '/start' || pathname.startsWith('/track/')) return <>{children}</>

  return (
    <>
      <CartUserGuard />
      <CustomerTermsGuard />
      <AppShell>{children}</AppShell>
      <BottomNav />
    </>
  )
}
