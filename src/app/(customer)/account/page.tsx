import { createClient } from '@/lib/supabase/server'
import { AccountClient } from './AccountClient'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="min-h-dvh bg-canvas flex flex-col font-body"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>
        <header className="bg-white px-5 pt-5 pb-4">
          <h1 className="font-heading font-extrabold text-[26px] text-ink">Account</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 pb-8">
          <div className="w-20 h-20 rounded-full bg-brand-tint flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0B7A47" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>
            </svg>
          </div>
          <div className="text-center flex flex-col gap-1.5">
            <p className="font-heading font-bold text-[18px] text-ink">Sign in to your account</p>
            <p className="text-[14px] text-ink-2">Save addresses and check out faster.</p>
          </div>
          <Link
            href="/login?next=/account"
            className="h-[52px] w-full max-w-xs rounded-2xl bg-brand text-white font-body font-bold text-[16px] flex items-center justify-center no-underline"
          >
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  const [{ data: profile }, { data: applications }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('applications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ])

  return (
    <AccountClient
      profile={profile}
      email={user.email ?? null}
      applications={applications ?? []}
    />
  )
}
