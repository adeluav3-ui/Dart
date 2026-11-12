import type { Metadata } from 'next'
import LegalPageShell from '../LegalPageShell'

export const metadata: Metadata = { title: 'Rider Agreement' }

export default function RiderAgreementPage() {
  return <LegalPageShell slug="rider_agreement" />
}
