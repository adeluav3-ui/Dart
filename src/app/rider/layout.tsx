import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CURRENT_LEGAL_VERSIONS } from '@/lib/legalVersions'

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

  // Admins bypass the terms check
  if (!roles.includes('admin')) {
    const slug = 'rider_agreement'
    const version = CURRENT_LEGAL_VERSIONS[slug]
    const { data: row } = await supabase
      .from('legal_acceptances')
      .select('id')
      .eq('user_id', user.id)
      .eq('document_slug', slug)
      .eq('document_version', version)
      .maybeSingle()

    if (!row) {
      const params = new URLSearchParams({ slugs: slug, role: 'rider', next: '/rider' })
      redirect(`/legal/re-accept?${params}`)
    }
  }

  return <>{children}</>
}
