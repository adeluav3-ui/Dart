import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CompleteProfileClient } from './CompleteProfileClient'

interface Props {
  searchParams: { next?: string; name?: string; terms?: string }
}

export default async function CompleteProfilePage({ searchParams }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone')
    .eq('id', user.id)
    .single()

  const termsParam = searchParams.terms === '1'

  // Profile complete: skip to destination unless we're here to record terms.
  if (profile?.full_name && profile?.phone && !termsParam) {
    redirect(searchParams.next || '/home')
  }

  const email = user.email ?? user.user_metadata?.email ?? ''
  const initialName = profile?.full_name
    ?? searchParams.name
    ?? user.user_metadata?.full_name
    ?? user.user_metadata?.name
    ?? ''

  // termsOnly=true when profile is already complete but terms haven't been accepted
  const termsOnly = !!(profile?.full_name && profile?.phone && termsParam)

  return (
    <CompleteProfileClient
      email={email}
      initialName={initialName}
      next={searchParams.next ?? '/home'}
      termsOnly={termsOnly}
    />
  )
}
