import { redirect } from 'next/navigation'

// Zone-based pricing removed — zones are managed inside the Areas page
export default function AdminZonesRedirect() {
  redirect('/admin/areas')
}
