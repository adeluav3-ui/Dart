import { createClient } from '@/lib/supabase/server'
import { parsePolicies } from '@/lib/parsePolicies'
import { PolicyContent } from '@/components/legal/PolicyContent'
import { BackButton } from '@/components/ui/BackButton'

export const dynamic = 'force-dynamic'

export default async function TermsPage() {
  const supabase = createClient()
  const { data: rows } = await supabase.from('app_settings').select('key, value')
  const settings = Object.fromEntries((rows ?? []).map(r => [r.key, r.value]))

  let policy
  try {
    policy = parsePolicies().find(p => p.slug === 'terms')
  } catch {
    policy = null
  }

  if (!policy) {
    return (
      <div className="min-h-dvh bg-canvas font-body text-ink"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>
        <header className="bg-white px-4 pt-5 pb-4 flex items-center gap-3 border-b border-line">
          <BackButton />
          <h1 className="font-heading font-extrabold text-[20px] text-ink">Terms of Use</h1>
        </header>
        <div className="px-4 pt-8 text-center text-ink-2">Could not load the document. Please try again later.</div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-canvas font-body text-ink"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>

      <header className="bg-white px-4 pt-5 pb-4 flex items-center gap-3 border-b border-line">
        <BackButton />
        <h1 className="font-heading font-extrabold text-[20px] text-ink">{policy.title}</h1>
      </header>

      <div className="px-4 pt-5 pb-8">
        <PolicyContent policy={policy} settings={settings} dateSettingKey="terms_last_updated" />
      </div>
    </div>
  )
}
