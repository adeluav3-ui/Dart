'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import { normalizePhone, validatePhone } from '@/lib/phone'
import type { Profile } from '@/types/database'

interface Props {
  profile: Profile | null
  email: string | null
}

export function ProfileClient({ profile, email }: Props) {
  const router = useRouter()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [rawPhone, setRawPhone] = useState(() => {
    const p = profile?.phone ?? ''
    return p.startsWith('+234') ? p.slice(4) : p.startsWith('0') ? p.slice(1) : p
  })
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [toast, setToast] = useState('')
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
    setToast('Profile saved')
    setTimeout(() => router.back(), 1200)
  }

  return (
    <div className="min-h-dvh bg-canvas font-body text-ink"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>

      <header className="bg-white px-4 pt-5 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-surface flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-heading font-extrabold text-[20px] text-ink">Edit profile</h1>
      </header>

      <div className="px-4 pt-4 flex flex-col gap-4">
        {email && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink-2">Email</label>
            <div className="h-11 px-3 rounded-xl border border-line bg-surface flex items-center">
              <span className="text-[14px] text-ink-2">{email}</span>
            </div>
            <p className="text-[11px] text-ink-2">Your email address can&apos;t be changed here.</p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold text-ink-2">Full name</label>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setNameError('') }}
            placeholder="First and last name"
            className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
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
      </div>

      {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
    </div>
  )
}
