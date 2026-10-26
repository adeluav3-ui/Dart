'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import Link from 'next/link'
import type { Profile } from '@/types/database'

export function AccountClient({ profile }: { profile: Profile | null }) {
  const [name, setName] = useState(profile?.full_name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function save() {
    if (!profile) return
    setSaving(true)
    await supabase.from('profiles').update({ full_name: name.trim() || null }).eq('id', profile.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-canvas font-body text-ink pb-24">
      <header className="bg-white px-5 pt-5 pb-3 border-b border-line">
        <h1 className="font-heading font-extrabold text-2xl">Account</h1>
      </header>

      <div className="px-4 py-4 flex flex-col gap-3">
        {profile ? (
          <div className="bg-white rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink-2">Phone</span>
              <span className="text-[15px] font-medium">{profile.phone}</span>
            </div>
            <Input
              label="Name (optional)"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
            />
            <Button onClick={save} loading={saving} size="lg">
              {saved ? 'Saved!' : 'Save'}
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-5">
            <p className="text-sm text-ink-2 mb-4">Sign in to manage your account</p>
            <Link href="/login" className="block h-btn rounded-2xl bg-brand text-white text-base font-bold flex items-center justify-center no-underline">
              Sign in
            </Link>
          </div>
        )}

        {profile && (
          <button
            type="button"
            onClick={signOut}
            className="h-btn-sm rounded-xl border border-line bg-white text-sm font-semibold text-ink-2 mt-2"
          >
            Sign out
          </button>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 h-[76px] px-3 pb-4 pt-2 bg-white border-t border-line grid grid-cols-4">
        <Link href="/" className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-ink-2 no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>
          Home
        </Link>
        <Link href="/orders" className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-ink-2 no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 4h10a1 1 0 0 1 1 1v15l-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1z"/><path d="M9 9h6M9 13h4"/></svg>
          Orders
        </Link>
        <Link href="/wallet" className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-ink-2 no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12.5h2M3 10h18"/></svg>
          Wallet
        </Link>
        <Link href="/account" className="flex flex-col items-center justify-center gap-1 text-xs font-bold text-brand no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>
          Account
        </Link>
      </nav>
    </div>
  )
}
