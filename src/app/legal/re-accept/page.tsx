import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLegalDoc } from '@/lib/legal'
import type { LegalSlug } from '@/lib/legal'
import { ReAcceptClient } from './ReAcceptClient'

const SLUG_TO_PATH: Record<string, string> = {
  customer_terms:   '/legal/terms',
  privacy_policy:   '/legal/privacy',
  vendor_agreement: '/legal/vendor-agreement',
  rider_agreement:  '/legal/rider-agreement',
}

interface Props {
  searchParams: { slugs?: string; role?: string; next?: string }
}

export default async function ReAcceptPage({ searchParams }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const rawSlugs = (searchParams.slugs ?? '').split(',').filter(Boolean) as LegalSlug[]
  const role = searchParams.role ?? 'customer'
  const next = searchParams.next ?? '/home'

  if (rawSlugs.length === 0) redirect(next)

  const docs = rawSlugs.map(slug => getLegalDoc(slug))
  const titles = docs.map(d => d.title)
  const docHrefs = rawSlugs.map(slug => SLUG_TO_PATH[slug] ?? '/legal/terms')

  return (
    <ReAcceptClient
      slugs={rawSlugs}
      titles={titles}
      docHrefs={docHrefs}
      role={role}
      next={next}
    />
  )
}
