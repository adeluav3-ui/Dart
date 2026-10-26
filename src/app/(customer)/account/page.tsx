import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccountClient } from './AccountClient'

export default async function AccountPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/account')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  return <AccountClient profile={profile} />
}
