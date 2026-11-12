'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CURRENT_LEGAL_VERSIONS } from '@/lib/legalVersions'

// Pages that must not trigger a redirect (would loop or don't need terms).
const EXEMPT = ['/complete-profile', '/login', '/start']

export function CustomerTermsGuard() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (EXEMPT.some(p => pathname.startsWith(p))) return
    if (pathname.startsWith('/legal/')) return

    const supabase = createClient()

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return // guest — no check needed

      const slugs: Array<keyof typeof CURRENT_LEGAL_VERSIONS> = [
        'customer_terms',
        'privacy_policy',
      ]

      const { data: rows } = await supabase
        .from('legal_acceptances')
        .select('document_slug, document_version')
        .eq('user_id', user.id)
        .in('document_slug', slugs)

      const accepted = new Map(
        (rows ?? []).map(r => [r.document_slug, r.document_version])
      )

      const neverAccepted: string[] = []
      const outdated: string[] = []

      for (const slug of slugs) {
        const current = CURRENT_LEGAL_VERSIONS[slug]
        const userVersion = accepted.get(slug)
        if (!userVersion) {
          neverAccepted.push(slug)
        } else if (userVersion !== current) {
          outdated.push(slug)
        }
      }

      if (neverAccepted.length > 0) {
        // Profile completion step — will show terms checkbox there
        router.replace(`/complete-profile?next=${encodeURIComponent(pathname)}&terms=1`)
        return
      }

      if (outdated.length > 0) {
        const params = new URLSearchParams({
          slugs: outdated.join(','),
          role: 'customer',
          next: pathname,
        })
        router.replace(`/legal/re-accept?${params}`)
      }
    })
  // pathname intentionally in deps so we re-check on navigation
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return null
}
