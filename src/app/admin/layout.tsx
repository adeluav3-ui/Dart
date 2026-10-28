import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AdminSignOut } from './AdminSignOut'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/')

  return (
    <div className="min-h-screen bg-canvas font-body text-ink flex flex-col">
      <header className="bg-ink text-white px-5 py-3 flex items-center justify-between">
        <span className="font-heading font-extrabold text-xl">Dart Admin</span>
        <AdminSignOut />
      </header>

      {/* Side nav — horizontal scroll on mobile */}
      <nav className="bg-[#1E2024] text-white flex gap-0 overflow-x-auto scrollbar-hide">
        {[
          { href: '/admin', label: 'Live' },
          { href: '/admin/dispatch', label: 'Dispatch' },
          { href: '/admin/users', label: 'Users' },
          { href: '/admin/vendors', label: 'Vendors' },
          { href: '/admin/zones', label: 'Zones' },
          { href: '/admin/fares', label: 'Fares' },
          { href: '/admin/riders', label: 'Riders' },
          { href: '/admin/money', label: 'Money' },
          { href: '/admin/metrics', label: 'Metrics' },
          { href: '/admin/review', label: 'Review' },
          { href: '/admin/applications', label: 'Applications' },
          { href: '/admin/support', label: 'Support' },
        ].map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="flex-none px-4 py-3 text-[13px] font-semibold text-[#B9BEC4] hover:text-white no-underline whitespace-nowrap"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <main className="flex-1 p-4">{children}</main>
    </div>
  )
}
