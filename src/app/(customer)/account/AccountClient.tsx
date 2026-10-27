'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X, ChevronRight, MapPin, Mail, HelpCircle, Store, Bike, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { normalizePhone, validatePhone } from '@/lib/phone'
import type { Profile, Application } from '@/types/database'

const APP_VERSION = '1.0.0'

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
}

export function AccountClient({ profile, email, applications }: Props) {
  const [sheet, setSheet] = useState<'edit' | 'help' | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const roles: string[] = profile?.roles ?? ['customer']
  const isVendor = roles.includes('vendor')
  const isRider = roles.includes('rider')

  const vendorApp = applications.find(a => a.kind === 'vendor')
  const riderApp = applications.find(a => a.kind === 'rider')

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
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
            onClick={() => setSheet('edit')}
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
                href="/vendor"
              />
            )}
            {isRider && (
              <SectionRow
                icon={<Bike size={18} />}
                title="Rider dashboard"
                subtitle="View your current job"
                href="/rider"
              />
            )}
          </div>
        )}

        {/* Addresses + Email */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <SectionRow
            icon={<MapPin size={18} />}
            title="Saved addresses"
            subtitle="Home · add your addresses"
            href="/account/addresses"
          />
          <SectionRow
            icon={<Mail size={18} />}
            title="Email updates"
            subtitle={email ? `Order updates go to ${email}` : 'Set your email'}
            href="/account/email-updates"
          />
        </div>

        <div className="bg-white rounded-2xl overflow-hidden">
          <SectionRow
            icon={<HelpCircle size={18} />}
            title="Help and support"
            subtitle="Call us or report a problem with an order"
            onPress={() => setSheet('help')}
          />
        </div>

        {/* Apply / application status */}
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
          <SectionRow
            icon={<FileText size={18} />}
            title="Terms and privacy"
            subtitle="Refund policy, terms of use"
            href="/terms"
          />
        </div>

        {/* Sign out */}
        <button
          type="button"
          onClick={signOut}
          className="bg-white rounded-2xl h-[52px] w-full font-bold text-[15px] text-danger"
        >
          Sign out
        </button>

        <p className="text-center text-[12px] text-ink-2 pb-2">Version {APP_VERSION}</p>
      </div>

      {/* Sheets */}
      {sheet === 'edit' && (
        <EditProfileSheet
          profile={profile}
          onClose={() => setSheet(null)}
          onSaved={() => { setSheet(null); router.refresh() }}
        />
      )}
      {sheet === 'help' && (
        <HelpSheet onClose={() => setSheet(null)} />
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

function EditProfileSheet({ profile, onClose, onSaved }: { profile: Profile | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(profile?.full_name ?? '')
  const [rawPhone, setRawPhone] = useState(() => {
    const p = profile?.phone ?? ''
    // Strip +234 prefix for display in the input
    return p.startsWith('+234') ? p.slice(4) : p.startsWith('0') ? p.slice(1) : p
  })
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const supabase = createClient()

  async function save() {
    if (!profile) return
    setNameError('')
    setPhoneError('')

    const nameTrimmed = name.trim()
    if (!nameTrimmed) { setNameError('Enter your full name'); return }
    if (nameTrimmed.split(/\s+/).length < 2) { setNameError('Enter both first and last name'); return }

    const fullRaw = '0' + rawPhone.replace(/\D/g, '')
    if (!validatePhone(fullRaw)) { setPhoneError('Enter a valid Nigerian mobile number'); return }
    const normalised = normalizePhone(fullRaw)!

    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: nameTrimmed, phone: normalised })
      .eq('id', profile.id)
    setSaving(false)
    if (error) { setPhoneError(error.message); return }
    onSaved()
  }

  return (
    <SheetWrapper title="Edit profile" onClose={onClose}>
      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-semibold text-ink-2">Full name</label>
        <input type="text" value={name} onChange={e => { setName(e.target.value); setNameError('') }}
          placeholder="First and last name"
          className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink" />
        {nameError && <p className="text-[12px] text-danger">{nameError}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-semibold text-ink-2">Phone number</label>
        <div className="flex h-11 rounded-xl border border-line bg-white overflow-hidden">
          <div className="flex items-center px-3 border-r border-line bg-surface shrink-0">
            <span className="text-[13px] font-semibold text-ink-2">NG +234</span>
          </div>
          <input
            type="tel"
            inputMode="tel"
            value={rawPhone}
            onChange={e => { setRawPhone(e.target.value); setPhoneError('') }}
            placeholder="8012345678"
            className="flex-1 px-3 font-body text-[14px] text-ink bg-transparent focus:outline-none"
          />
        </div>
        {phoneError && <p className="text-[12px] text-danger">{phoneError}</p>}
      </div>
      <Button onClick={save} loading={saving} fullWidth size="lg">Save changes</Button>
    </SheetWrapper>
  )
}

function HelpSheet({ onClose }: { onClose: () => void }) {
  return (
    <SheetWrapper title="Help and support" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="bg-brand-tint rounded-2xl p-4 flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-brand-ink">Call us</p>
          <a
            href="tel:+2348000000000"
            className="h-11 rounded-xl bg-brand text-white font-bold text-[15px] flex items-center justify-center no-underline"
          >
            +234 800 000 0000
          </a>
          <p className="text-[12px] text-brand-ink/70 text-center">Mon – Sat · 8 am – 9 pm</p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-ink-2">Common questions</p>
          {[
            'Where is my order?',
            'I want a refund',
            'An item was missing',
            'Wrong order delivered',
          ].map(q => (
            <div key={q} className="bg-white rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-[14px] text-ink">{q}</span>
              <ChevronRight size={16} className="text-ink-2" />
            </div>
          ))}
        </div>
      </div>
    </SheetWrapper>
  )
}
