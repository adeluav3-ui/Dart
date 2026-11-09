import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Zone-based pricing removed â€” zones are managed inside the Areas page
export default function AdminZonesRedirect() {
  redirect('/admin/areas')
}
