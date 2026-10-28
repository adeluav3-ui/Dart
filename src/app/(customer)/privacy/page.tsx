import { createClient } from '@/lib/supabase/server'
import { parsePolicies } from '@/lib/parsePolicies'
import { PolicyContent } from '@/components/legal/PolicyContent'
import { BackButton } from '@/components/ui/BackButton'

export const dynamic = 'force-dynamic'

export default async function PrivacyPage() {
  const supabase = createClient()
  const { data: rows } = await supabase.from('app_settings').select('key, value')
  const settings = Object.fromEntries((rows ?? []).map(r => [r.key, r.value]))

  const policy = parsePolicies().find(p => p.slug === 'privacy')!

  return (
    <div className="min-h-dvh bg-canvas font-body text-ink"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>

      <header className="bg-white px-4 pt-5 pb-4 flex items-center gap-3 border-b border-line">
        <BackButton />
        <h1 className="font-heading font-extrabold text-[20px] text-ink">{policy.title}</h1>
      </header>

      <div className="px-4 pt-5 pb-8">
        <PolicyContent policy={policy} settings={settings} dateSettingKey="privacy_last_updated" />
      </div>
    </div>
  )
}
