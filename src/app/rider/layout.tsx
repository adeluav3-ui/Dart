import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function RiderLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/rider')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'rider' && profile.role !== 'admin')) redirect('/')

  return <>{children}</>
}
