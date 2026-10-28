import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NotificationsClient } from './NotificationsClient'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/account/notifications')

  const { data: profile } = await supabase
    .from('profiles')
    .select('marketing_emails')
    .eq('id', user.id)
    .single()

  return (
    <NotificationsClient
      userId={user.id}
      marketingEmails={profile?.marketing_emails ?? true}
    />
  )
}
