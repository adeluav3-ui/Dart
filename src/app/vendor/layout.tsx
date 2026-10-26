import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirect=/vendor')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'vendor' && profile.role !== 'admin')) {
    redirect('/')
  }

  return <>{children}</>
}
