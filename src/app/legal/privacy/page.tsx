import type { Metadata } from 'next'
import LegalPageShell from '../LegalPageShell'

export const metadata: Metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  return <LegalPageShell slug="privacy_policy" />
}
