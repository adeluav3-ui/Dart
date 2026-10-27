import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function RiderLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/rider')

  const { data: profile } = await supabase
    .from('profiles')
    .select('roles')
    .eq('id', user.id)
    .single()

  const roles: string[] = profile?.roles ?? []
  if (!roles.includes('rider') && !roles.includes('admin')) redirect('/')

  return <>{children}</>
}
