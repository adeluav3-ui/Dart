import type { Metadata } from 'next'
import LegalPageShell from '../LegalPageShell'

export const metadata: Metadata = { title: 'Vendor Partner Agreement' }

export default function VendorAgreementPage() {
  return <LegalPageShell slug="vendor_agreement" />
}
