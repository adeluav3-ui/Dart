import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HelpClient } from './HelpClient'

export const dynamic = 'force-dynamic'

export default async function HelpPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/account/help')

  const [{ data: settings }, { data: profile }] = await Promise.all([
    supabase.from('app_settings').select('key, value'),
    supabase.from('profiles').select('roles').eq('id', user.id).single(),
  ])

  const roles: string[] = profile?.roles ?? []
  const isAdmin = roles.includes('admin')
  const settingsMap = Object.fromEntries((settings ?? []).map(s => [s.key, s.value]))

  // Admins see all tickets; users see only theirs
  const ticketQuery = isAdmin
    ? supabase.from('support_tickets').select('*').order('created_at', { ascending: false })
    : supabase.from('support_tickets').select('*').eq('user_id', user.id).order('created_at', { ascending: false })

  const [{ data: tickets }, { data: orders }] = await Promise.all([
    ticketQuery,
    supabase
      .from('orders')
      .select('id, code, created_at')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return (
    <HelpClient
      userId={user.id}
      settings={settingsMap}
      tickets={tickets ?? []}
      orders={orders ?? []}
      isAdmin={isAdmin}
    />
  )
}
