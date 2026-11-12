import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LEGAL_SLUGS, getCurrentVersion } from '@/lib/legal'
import type { LegalSlug } from '@/lib/legal'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json()
  const { slugs, role, vendorId, businessType } = body as {
    slugs: unknown
    role: unknown
    vendorId?: unknown
    businessType?: unknown
  }

  if (!Array.isArray(slugs) || slugs.length === 0) {
    return NextResponse.json({ error: 'slugs must be a non-empty array' }, { status: 400 })
  }
  if (!['customer', 'vendor', 'rider'].includes(String(role))) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null
  const ua = req.headers.get('user-agent')
  const admin = createAdminClient()

  for (const slug of slugs) {
    if (!LEGAL_SLUGS.includes(slug as LegalSlug)) {
      return NextResponse.json({ error: `Unknown slug: ${slug}` }, { status: 400 })
    }

    const { error } = await admin.from('legal_acceptances').insert({
      user_id:          user.id,
      document_slug:    slug as string,
      document_version: getCurrentVersion(slug as LegalSlug),
      role:             String(role),
      vendor_id:        typeof vendorId === 'string' ? vendorId : null,
      business_type:    typeof businessType === 'string' ? businessType : null,
      ip_address:       ip,
      user_agent:       ua,
    })

    if (error && error.code !== '23505') {
      console.error('[legal/accept] insert failed:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
