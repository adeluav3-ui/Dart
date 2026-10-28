'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X, ChevronRight, MapPin, Bell, HelpCircle, Store, Bike, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import type { Profile, Application } from '@/types/database'

function initials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0].slice(0, 2).toUpperCase()
}

interface Props {
  profile: Profile | null
  email: string | null
  applications: Application[]
  userId: string
  version: string
}

type Sheet = null | 'signout' | 'deleteaccount' | 'legal'

export function AccountClient({ profile, email, applications, userId, version }: Props) {
  const [sheet, setSheet] = useState<Sheet>(null)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const roles: string[] = profile?.roles ?? ['customer']
  const isVendor = roles.includes('vendor')
  const isRider = roles.includes('rider')

  const vendorApp = applications.find(a => a.kind === 'vendor')
  const riderApp = applications.find(a => a.kind === 'rider')

  async function switchDashboard(destination: '/vendor' | '/rider') {
    await supabase.from('profiles').update({ last_dashboard: destination }).eq('id', userId)
    window.location.href = destination
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  async function deleteAccount() {
    setDeletingAccount(true)
    await supabase.from('support_tickets').insert({
      user_id: userId,
      subject: 'Account deletion request',
      body: 'User requested account deletion via the app.',
    })
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="min-h-dvh bg-canvas font-body text-ink"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>

      <header className="bg-white px-5 pt-5 pb-4">
        <h1 className="font-heading font-extrabold text-[26px] text-ink">Account</h1>
      </header>

      <div className="px-4 pt-4 flex flex-col gap-3">
        {/* Profile card */}
        <div className="bg-white rounded-2xl p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-brand-tint flex items-center justify-center shrink-0">
            <span className="font-heading font-extrabold text-[18px] text-brand-ink">
              {initials(profile?.full_name ?? null)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[16px] text-ink truncate">{profile?.full_name ?? 'Set your name'}</p>
            {email && <p className="text-[13px] text-ink-2 truncate">{email}</p>}
            {profile?.phone && <p className="text-[13px] text-ink-2">{profile.phone}</p>}
          </div>
          <button
            type="button"
            onClick={() => router.push('/account/profile')}
            className="h-8 px-3 rounded-lg bg-surface text-[13px] font-semibold text-ink shrink-0"
          >
            Edit
          </button>
        </div>

        {/* Switch to other dashboard if approved */}
        {(isVendor || isRider) && (
          <div className="bg-white rounded-2xl overflow-hidden">
            {isVendor && (
              <SectionRow
                icon={<Store size={18} />}
                title="Vendor dashboard"
                subtitle="Manage your menu and orders"
                onPress={() => switchDashboard('/vendor')}
              />
            )}
            {isRider && (
              <SectionRow
                icon={<Bike size={18} />}
                title="Rider dashboard"
                subtitle="View your current job"
                onPress={() => switchDashboard('/rider')}
              />
            )}
          </div>
        )}

        {/* Addresses + Notifications */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <SectionRow
            icon={<MapPin size={18} />}
            title="Saved addresses"
            subtitle="Add and manage delivery addresses"
            href="/account/addresses"
          />
          <SectionRow
            icon={<Bell size={18} />}
            title="Email updates"
            subtitle="Order updates and promotions"
            href="/account/notifications"
          />
        </div>

        {/* Help */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <SectionRow
            icon={<HelpCircle size={18} />}
            title="Help and support"
            subtitle="Call us or report a problem with an order"
            href="/account/help"
          />
        </div>

        {/* Apply / application status */}
        {(!isVendor || !isRider) && (
          <div className="bg-white rounded-2xl overflow-hidden">
            {!isVendor && (
              <ApplicationRow
                icon={<Store size={18} />}
                title="Sell on Dart"
                subtitle="List your kitchen, shop or pharmacy"
                kind="vendor"
                app={vendorApp ?? null}
              />
            )}
            {!isRider && (
              <ApplicationRow
                icon={<Bike size={18} />}
                title="Ride with Dart"
                subtitle="Earn delivering in Sagamu"
                kind="rider"
                app={riderApp ?? null}
              />
            )}
          </div>
        )}

        {/* Legal */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <SectionRow
            icon={<FileText size={18} />}
            title="Terms and privacy"
            subtitle="Terms of use, privacy policy, refund policy"
            onPress={() => setSheet('legal')}
          />
        </div>

        {/* Sign out */}
        <button
          type="button"
          onClick={() => setSheet('signout')}
          className="bg-white rounded-2xl h-[52px] w-full font-bold text-[15px] text-danger"
        >
          Sign out
        </button>

        {/* Delete account */}
        <button
          type="button"
          onClick={() => setSheet('deleteaccount')}
          className="h-10 w-full text-[13px] font-semibold text-ink-2"
        >
          Delete account
        </button>

        <p className="text-center text-[12px] text-ink-2 pb-2">Version {version}</p>
      </div>

      {/* Legal links sheet */}
      {sheet === 'legal' && (
        <SheetWrapper title="Terms and privacy" onClose={() => setSheet(null)}>
          <Link href="/terms" onClick={() => setSheet(null)}
            className="flex items-center justify-between py-3 border-b border-line no-underline">
            <span className="text-[15px] font-semibold text-ink">Terms of use</span>
            <ChevronRight size={16} className="text-ink-2" />
          </Link>
          <Link href="/privacy" onClick={() => setSheet(null)}
            className="flex items-center justify-between py-3 border-b border-line no-underline">
            <span className="text-[15px] font-semibold text-ink">Privacy policy</span>
            <ChevronRight size={16} className="text-ink-2" />
          </Link>
          <Link href="/refunds" onClick={() => setSheet(null)}
            className="flex items-center justify-between py-3 no-underline">
            <span className="text-[15px] font-semibold text-ink">Refund policy</span>
            <ChevronRight size={16} className="text-ink-2" />
          </Link>
        </SheetWrapper>
      )}

      {/* Sign out confirm */}
      {sheet === 'signout' && (
        <SheetWrapper title="Sign out?" onClose={() => setSheet(null)}>
          <p className="text-[14px] text-ink-2 leading-relaxed">
            You&apos;ll need to sign back in to see your orders and account.
          </p>
          <Button variant="danger" onClick={signOut} fullWidth size="lg">Sign out</Button>
          <Button variant="ghost" onClick={() => setSheet(null)} fullWidth size="lg">Cancel</Button>
        </SheetWrapper>
      )}

      {/* Delete account confirm */}
      {sheet === 'deleteaccount' && (
        <SheetWrapper title="Delete account" onClose={() => setSheet(null)}>
          <p className="text-[14px] text-ink-2 leading-relaxed">
            We&apos;ll process your request within 48 hours. Your orders, addresses and data will be removed.
          </p>
          <Button variant="danger" onClick={deleteAccount} loading={deletingAccount} fullWidth size="lg">
            Delete my account
          </Button>
          <Button variant="ghost" onClick={() => setSheet(null)} fullWidth size="lg">Cancel</Button>
        </SheetWrapper>
      )}
    </div>
  )
}

function ApplicationRow({
  icon,
  title,
  subtitle,
  kind,
  app,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  kind: 'vendor' | 'rider'
  app: Application | null
}) {
  if (!app) {
    return (
      <Link href={`/account/apply/${kind}`} className="block no-underline">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-line last:border-0">
          <div className="w-9 h-9 rounded-xl bg-surface flex items-center justify-center shrink-0 text-ink-2">{icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-ink">{title}</p>
            <p className="text-[12px] text-ink-2 mt-0.5 truncate">{subtitle}</p>
          </div>
          <ChevronRight size={18} className="text-ink-2 shrink-0" />
        </div>
      </Link>
    )
  }

  const canReapply = app.status === 'rejected' && (() => {
    const decided = app.decided_at ? new Date(app.decided_at).getTime() : 0
    return Date.now() - decided > 30 * 24 * 60 * 60 * 1000
  })()

  const statusLabel: Record<string, string> = {
    submitted: 'Under review',
    contacted: 'We contacted you',
    approved: 'Approved',
    rejected: 'Not approved',
  }
  const statusColor: Record<string, string> = {
    submitted: 'bg-warn-tint text-warn',
    contacted: 'bg-brand-tint text-brand-ink',
    approved: 'bg-brand-tint text-brand-ink',
    rejected: 'bg-red-50 text-danger',
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3.5 border-b border-line last:border-0">
      <div className="w-9 h-9 rounded-xl bg-surface flex items-center justify-center shrink-0 text-ink-2">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[15px] font-semibold text-ink">{title}</p>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${statusColor[app.status] ?? ''}`}>
            {statusLabel[app.status] ?? app.status}
          </span>
        </div>
        {app.status === 'rejected' && app.admin_note && (
          <p className="text-[12px] text-ink-2 mt-0.5">{app.admin_note}</p>
        )}
        {app.status === 'rejected' && !canReapply && (
          <p className="text-[12px] text-ink-2 mt-0.5">You can reapply after 30 days.</p>
        )}
        {app.status === 'rejected' && canReapply && (
          <Link href={`/account/apply/${kind}`} className="text-[12px] text-brand font-semibold mt-0.5 block">
            Reapply now →
          </Link>
        )}
      </div>
    </div>
  )
}

function SectionRow({
  icon,
  title,
  subtitle,
  href,
  onPress,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  href?: string
  onPress?: () => void
}) {
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-line last:border-0">
      <div className="w-9 h-9 rounded-xl bg-surface flex items-center justify-center shrink-0 text-ink-2">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-ink">{title}</p>
        {subtitle && <p className="text-[12px] text-ink-2 mt-0.5 truncate">{subtitle}</p>}
      </div>
      <ChevronRight size={18} className="text-ink-2 shrink-0" />
    </div>
  )

  if (href) return <Link href={href} className="block no-underline">{inner}</Link>
  return <button type="button" onClick={onPress} className="w-full text-left">{inner}</button>
}

function SheetWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-3xl max-w-md mx-auto flex flex-col"
        style={{ maxHeight: '88dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
          <span className="font-heading font-bold text-[17px]">{title}</span>
          <button type="button" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-surface">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-6 flex flex-col gap-3">
          {children}
        </div>
      </div>
    </>
  )
}
