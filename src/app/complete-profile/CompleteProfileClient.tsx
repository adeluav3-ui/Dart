'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { normalizePhone, validatePhone } from '@/lib/phone'
import { Button } from '@/components/ui/Button'

interface Props {
  email: string
  initialName: string
  next: string
}

export function CompleteProfileClient({ email, initialName, next }: Props) {
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [nameError, setNameError] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  function handlePhoneChange(raw: string) {
    // Strip the +234 prefix if user types it (we show it fixed in the UI)
    const cleaned = raw.replace(/^\+?234/, '').replace(/^0/, '')
    setPhone(cleaned)
    setPhoneError('')
  }

  async function handleSubmit() {
    setPhoneError('')
    setNameError('')

    const nameTrimmed = name.trim()
    if (!nameTrimmed) { setNameError('Enter your full name'); return }
    if (nameTrimmed.split(/\s+/).length < 2) { setNameError('Enter both first and last name'); return }

    // Reconstruct full number for validation
    const rawPhone = '0' + phone.replace(/\D/g, '')
    if (!validatePhone(rawPhone)) {
      setPhoneError('Enter a valid Nigerian mobile number (e.g. 08012345678)')
      return
    }
    const normalised = normalizePhone(rawPhone)!

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: nameTrimmed, phone: normalised })
      .eq('id', user.id)

    setSaving(false)
    if (error) { setPhoneError(error.message); return }

    router.push(next || '/home')
  }

  return (
    <div className="min-h-dvh bg-canvas font-body text-ink flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm flex flex-col gap-6">

        {/* Top: tick + signed-in-as */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-brand-tint flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0B7A47" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <p className="text-[13px] text-ink-2">Signed in as {email}</p>
        </div>

        {/* Heading */}
        <div className="flex flex-col gap-1 text-center">
          <h1 className="font-heading font-extrabold text-[26px] text-ink leading-tight">
            One last thing
          </h1>
          <p className="text-[14px] text-ink-2 leading-snug">
            Your rider calls you at delivery — add your name and number so they reach the right person.
          </p>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink-2">Full name</label>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={e => { setName(e.target.value); setNameError('') }}
              placeholder="First and last name"
              className="h-12 px-4 rounded-xl border border-line bg-white font-body text-[15px] text-ink focus:outline-none focus:border-brand"
            />
            {nameError && <p className="text-[12px] text-danger">{nameError}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink-2">Phone number</label>
            <div className="flex h-12 rounded-xl border border-line bg-white overflow-hidden focus-within:border-brand">
              <div className="flex items-center px-3 border-r border-line bg-surface shrink-0">
                <span className="text-[14px] font-semibold text-ink-2">NG +234</span>
              </div>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={e => handlePhoneChange(e.target.value)}
                placeholder="8012345678"
                className="flex-1 px-3 font-body text-[15px] text-ink bg-transparent focus:outline-none"
              />
            </div>
            {phoneError ? (
              <p className="text-[12px] text-danger">{phoneError}</p>
            ) : (
              <p className="text-[12px] text-ink-2">
                Use a number that&apos;s on when you order. Riders call this number at delivery.
              </p>
            )}
          </div>
        </div>

        <Button onClick={handleSubmit} loading={saving} fullWidth size="lg">
          Continue
        </Button>
      </div>
    </div>
  )
}
