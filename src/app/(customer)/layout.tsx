'use client'

import { usePathname } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { BottomNav } from '@/components/BottomNav'
import { CartUserGuard } from '@/components/CartUserGuard'

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Splash screen renders full-screen with no shell
  if (pathname === '/') return <>{children}</>

  return (
    <>
      <CartUserGuard />
      <AppShell>{children}</AppShell>
      <BottomNav />
    </>
  )
}
