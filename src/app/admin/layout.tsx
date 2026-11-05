import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminSidebar } from './AdminSidebar'

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
    <div className="min-h-screen bg-canvas font-body text-ink">
      <AdminSidebar />
      {/* Desktop: offset for sidebar. Mobile: offset for top bar. */}
      <div className="lg:pl-[220px] pt-14 lg:pt-0">
        {children}
      </div>
    </div>
  )
}
