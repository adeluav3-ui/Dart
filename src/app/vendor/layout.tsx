import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirect=/vendor')

  const { data: profile } = await supabase
    .from('profiles')
    .select('roles')
    .eq('id', user.id)
    .single()

  const roles: string[] = profile?.roles ?? []
  if (!roles.includes('vendor') && !roles.includes('admin')) {
    redirect('/')
  }

  return <>{children}</>
}
