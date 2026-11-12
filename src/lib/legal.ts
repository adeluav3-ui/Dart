import { cache } from 'react'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

export type LegalSlug = 'customer_terms' | 'privacy_policy' | 'vendor_agreement' | 'rider_agreement'

export const LEGAL_SLUGS: LegalSlug[] = [
  'customer_terms',
  'privacy_policy',
  'vendor_agreement',
  'rider_agreement',
]

const SLUG_TO_FILE: Record<LegalSlug, string> = {
  customer_terms:   'customer-terms.md',
  privacy_policy:   'privacy-policy.md',
  vendor_agreement: 'vendor-agreement.md',
  rider_agreement:  'rider-agreement.md',
}

export interface LegalDoc {
  slug: LegalSlug
  title: string
  version: string
  effective_date: string
  content: string
}

function readDoc(slug: LegalSlug): LegalDoc {
  const filePath = path.join(process.cwd(), 'content', 'legal', SLUG_TO_FILE[slug])
  const raw = fs.readFileSync(filePath, 'utf8')
  const { data, content } = matter(raw)
  return {
    slug,
    title: String(data.title ?? ''),
    version: String(data.version ?? '1.0'),
    effective_date: String(data.effective_date ?? ''),
    content,
  }
}

export const getLegalDoc = cache(readDoc)

export function getCurrentVersion(slug: LegalSlug): string {
  return readDoc(slug).version
}

// All current versions — used in the accept API to validate incoming slugs/versions.
export function getCurrentVersions(): Record<LegalSlug, string> {
  const result = {} as Record<LegalSlug, string>
  for (const slug of LEGAL_SLUGS) {
    result[slug] = getCurrentVersion(slug)
  }
  return result
}
