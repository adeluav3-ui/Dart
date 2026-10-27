'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, ChevronRight, MapPin, Mail, HelpCircle, Store, Bike, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import type { Profile } from '@/types/database'

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
}

export function AccountClient({ profile, email }: Props) {
  const [sheet, setSheet] = useState<'edit' | 'sell' | 'ride' | 'help' | null>(null)
  const router = useRouter()
  const supabase = createClient()

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

        {/* Main sections */}
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

        <div className="bg-white rounded-2xl overflow-hidden">
          <SectionRow
            icon={<Store size={18} />}
            title="Sell on Dart"
            subtitle="List your kitchen, shop or pharmacy"
            onPress={() => setSheet('sell')}
          />
          <SectionRow
            icon={<Bike size={18} />}
            title="Ride with Dart"
            subtitle="Earn delivering in Sagamu"
            onPress={() => setSheet('ride')}
          />
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
      {sheet === 'sell' && (
        <SellOnDartSheet onClose={() => setSheet(null)} profile={profile} />
      )}
      {sheet === 'ride' && (
        <RideWithDartSheet onClose={() => setSheet(null)} profile={profile} />
      )}
      {sheet === 'help' && (
        <HelpSheet onClose={() => setSheet(null)} />
      )}
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

  if (href) {
    const Link = require('next/link').default
    return <Link href={href} className="block no-underline">{inner}</Link>
  }
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
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function save() {
    if (!profile) return
    setError('')
    if (!name.trim()) { setError('Enter your name'); return }
    setSaving(true)
    const normalised = phone.trim().replace(/^0/, '+234')
    const { error: dbErr } = await supabase
      .from('profiles')
      .update({ full_name: name.trim(), phone: normalised || null })
      .eq('id', profile.id)
    setSaving(false)
    if (dbErr) { setError(dbErr.message); return }
    onSaved()
  }

  return (
    <SheetWrapper title="Edit profile" onClose={onClose}>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-ink-2">Full name</span>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Your name"
          className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-ink-2">Phone number</span>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
          placeholder="e.g. 08012345678"
          className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink" />
      </label>
      {error && <p className="text-[13px] text-danger">{error}</p>}
      <Button onClick={save} loading={saving} fullWidth size="lg">Save changes</Button>
    </SheetWrapper>
  )
}

function SellOnDartSheet({ onClose, profile }: { onClose: () => void; profile: Profile | null }) {
  const [bizName, setBizName] = useState('')
  const [type, setType] = useState('restaurant')
  const [area, setArea] = useState('')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function submit() {
    setError('')
    if (!bizName.trim()) { setError('Enter your business name'); return }
    if (!area.trim()) { setError('Enter your area'); return }
    if (!phone.trim()) { setError('Enter a phone number'); return }
    setSaving(true)
    const { error: dbErr } = await supabase.from('vendor_applications').insert({
      user_id: profile?.id ?? null,
      business_name: bizName.trim(),
      type,
      area_name: area.trim(),
      phone: phone.trim(),
    })
    setSaving(false)
    if (dbErr) { setError(dbErr.message); return }
    setDone(true)
  }

  return (
    <SheetWrapper title="Sell on Dart" onClose={onClose}>
      {done ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="w-14 h-14 rounded-full bg-brand-tint flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0B7A47" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <p className="font-heading font-bold text-[17px] text-ink">Request received!</p>
          <p className="text-[14px] text-ink-2">We&apos;ll review your application and call you within 48 hours.</p>
          <Button onClick={onClose} fullWidth size="lg">Done</Button>
        </div>
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-ink-2">Business name</span>
            <input type="text" value={bizName} onChange={e => setBizName(e.target.value)} placeholder="e.g. Mama Tolu's Kitchen"
              className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-ink-2">Type</span>
            <select value={type} onChange={e => setType(e.target.value)}
              className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink bg-white">
              <option value="restaurant">Restaurant / Kitchen</option>
              <option value="supermarket">Supermarket / Grocery</option>
              <option value="pharmacy">Pharmacy</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-ink-2">Area in Sagamu</span>
            <input type="text" value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Isale-Oko"
              className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-ink-2">Phone number</span>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="08012345678"
              className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink" />
          </label>
          {error && <p className="text-[13px] text-danger">{error}</p>}
          <Button onClick={submit} loading={saving} fullWidth size="lg">Submit application</Button>
        </>
      )}
    </SheetWrapper>
  )
}

function RideWithDartSheet({ onClose, profile }: { onClose: () => void; profile: Profile | null }) {
  const [name, setName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [area, setArea] = useState('')
  const [hasBike, setHasBike] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function submit() {
    setError('')
    if (!name.trim()) { setError('Enter your name'); return }
    if (!phone.trim()) { setError('Enter your phone number'); return }
    if (!area.trim()) { setError('Enter your area'); return }
    setSaving(true)
    const { error: dbErr } = await supabase.from('rider_applications').insert({
      user_id: profile?.id ?? null,
      full_name: name.trim(),
      phone: phone.trim(),
      area_name: area.trim(),
      has_bike: hasBike,
    })
    setSaving(false)
    if (dbErr) { setError(dbErr.message); return }
    setDone(true)
  }

  return (
    <SheetWrapper title="Ride with Dart" onClose={onClose}>
      {done ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="w-14 h-14 rounded-full bg-brand-tint flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0B7A47" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <p className="font-heading font-bold text-[17px] text-ink">Application submitted!</p>
          <p className="text-[14px] text-ink-2">We&apos;ll call you within 48 hours to complete onboarding.</p>
          <Button onClick={onClose} fullWidth size="lg">Done</Button>
        </div>
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-ink-2">Full name</span>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name"
              className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-ink-2">Phone number</span>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="08012345678"
              className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-ink-2">Area you live in</span>
            <input type="text" value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Ijokun"
              className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink" />
          </label>
          <button
            type="button"
            onClick={() => setHasBike(!hasBike)}
            className={`flex items-center gap-3 h-12 px-4 rounded-xl border-2 text-[14px] font-semibold transition-colors ${
              hasBike ? 'border-brand bg-brand-tint text-brand-ink' : 'border-line text-ink'
            }`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
              hasBike ? 'bg-brand border-brand' : 'border-line'
            }`}>
              {hasBike && <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
            </div>
            I have my own motorcycle
          </button>
          {error && <p className="text-[13px] text-danger">{error}</p>}
          <Button onClick={submit} loading={saving} fullWidth size="lg">Submit application</Button>
        </>
      )}
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
