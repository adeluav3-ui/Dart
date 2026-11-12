import type { Metadata } from 'next'
import LegalPageShell from '../LegalPageShell'

export const metadata: Metadata = { title: 'Terms of Use' }

export default function TermsPage() {
  return <LegalPageShell slug="customer_terms" />
}
