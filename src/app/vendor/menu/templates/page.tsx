import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TemplatePickerClient } from './TemplatePickerClient'

export default async function TemplatesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: vendor } = await supabase
    .from('vendors')
    .select('*')
    .eq('owner_id', user!.id)
    .single()

  if (!vendor) return <p className="p-6 text-ink-2">No vendor account found.</p>

  const admin = createAdminClient()

  const [{ data: templates }, { data: categories }] = await Promise.all([
    admin
      .from('menu_templates')
      .select('*')
      .order('sort_order'),
    supabase
      .from('menu_categories')
      .select('name')
      .eq('vendor_id', vendor.id),
  ])

  const existingCategoryNames = (categories ?? []).map((c: { name: string }) => c.name)

  return (
    <TemplatePickerClient
      vendor={vendor}
      templates={templates ?? []}
      existingCategoryNames={existingCategoryNames}
    />
  )
}
