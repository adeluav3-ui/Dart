import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Vendor } from '@/types/database'

export default async function AdminVendorsPage() {
  const supabase = createClient()
  const { data: vendors } = await supabase
    .from('vendors')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="font-heading font-bold text-xl">Vendors ({vendors?.length ?? 0})</h2>
        <Link href="/admin/vendors/new" className="h-9 px-4 rounded-xl bg-brand text-white text-sm font-bold flex items-center no-underline">
          + Add vendor
        </Link>
      </div>

      {(vendors ?? []).map((vendor: Vendor) => (
        <Link
          key={vendor.id}
          href={`/admin/vendors/${vendor.id}`}
          className="bg-white rounded-2xl p-4 flex flex-col gap-1.5 no-underline text-ink"
        >
          <div className="flex justify-between items-start">
            <span className="font-bold text-base">{vendor.name}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              vendor.is_verified ? 'bg-brand-tint text-brand-ink' : 'bg-surface text-ink-2'
            }`}>
              {vendor.is_verified ? 'Verified' : 'Not verified'}
            </span>
          </div>
          <span className="text-sm text-ink-2">{vendor.type} · {vendor.category}</span>
          <span className="text-sm text-ink-2">
            Commission: {(vendor.commission_rate * 100).toFixed(0)}% ·
            {vendor.is_open ? ' Open' : ' Closed'}
          </span>
        </Link>
      ))}
    </div>
  )
}
