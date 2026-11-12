// Client-safe legal version constants.
// MUST be kept in sync with the `version` field in content/legal/*.md frontmatter.
// When you bump a version in a Markdown file, bump the matching value here too.
export const CURRENT_LEGAL_VERSIONS = {
  customer_terms:   '1.0',
  privacy_policy:   '1.0',
  vendor_agreement: '1.0',
  rider_agreement:  '1.0',
} as const

export type LegalSlug = keyof typeof CURRENT_LEGAL_VERSIONS
