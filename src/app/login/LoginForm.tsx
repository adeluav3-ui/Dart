'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DartLogo } from '@/components/ui/DartLogo'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Step = 'email' | 'sent' | 'profile'

function roleHome(role: string | null | undefined) {
  if (role === 'vendor') return '/vendor'
  if (role === 'rider') return '/rider'
  if (role === 'admin') return '/admin'
  return '/home'
}

// ── Main form ─────────────────────────────────────────────────────────────────
export function LoginForm() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendSeconds, setResendSeconds] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || searchParams.get('redirect') || '/home'
  const startComplete = searchParams.get('complete') === '1'
  const supabase = createClient()

  // If auth/callback sent us here with ?complete=1, jump to profile step
  useEffect(() => {
    if (startComplete) setStep('profile')
  }, [startComplete])

  function startResendTimer() {
    setResendSeconds(45)
    timerRef.current = setInterval(() => {
      setResendSeconds(s => {
        if (s <= 1) { clearInterval(timerRef.current!); return 0 }
        return s - 1
      })
    }, 1000)
  }

  async function sendLink() {
    setError('')
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setStep('sent')
      startResendTimer()
    }
  }

  async function saveProfile() {
    setError('')
    if (!name.trim()) { setError('Enter your name'); return }
    if (!phone.trim()) { setError('Enter your phone number'); return }
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Session expired — go back and sign in again'); setLoading(false); return }

    // Normalise NG phone
    const normalised = phone.trim().replace(/^0/, '+234')

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: name.trim(), phone: normalised })
      .eq('id', user.id)

    setLoading(false)
    if (error) { setError(error.message); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    router.replace(next === '/home' ? roleHome(profile?.role) : next)
    router.refresh()
  }

  async function signInWithGoogle() {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  // ── Shared chrome ─────────────────────────────────────────────────────────
  function TopBar({ onBack }: { onBack?: () => void }) {
    return (
      <div className="flex items-center justify-between px-4 pt-4 pb-2" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="w-11 h-11 flex items-center justify-center rounded-full text-ink"
            aria-label="Back"
          >
            <ArrowLeft size={22} />
          </button>
        ) : <div className="w-11" />}

        <Link
          href="/home"
          className="text-sm font-semibold text-ink-2 min-h-[44px] flex items-center"
        >
          Not now
        </Link>
      </div>
    )
  }

  // ── Step: email ───────────────────────────────────────────────────────────
  if (step === 'email') {
    return (
      <div className="min-h-dvh bg-white flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <TopBar />

        <div className="flex-1 flex flex-col px-6 pt-4 pb-8 gap-8">
          <div className="flex flex-col items-center gap-1 pt-2">
            <DartLogo />
          </div>

          <div className="flex flex-col gap-1.5">
            <h1 className="font-heading font-extrabold text-[28px] text-ink">Sign in to Dart</h1>
            <p className="text-[15px] text-ink-2 leading-relaxed">
              Save your addresses, track your orders and check out faster.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {/* Google */}
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={googleLoading}
              className="flex items-center justify-center gap-3 h-btn rounded-2xl border-2 border-line bg-white font-body text-[15px] font-semibold text-ink transition-colors active:bg-surface disabled:opacity-60"
            >
              {googleLoading ? (
                <span className="w-5 h-5 rounded-full border-2 border-ink/30 border-t-ink animate-spin" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-line" />
              <span className="text-xs text-ink-2">or</span>
              <div className="flex-1 h-px bg-line" />
            </div>

            {/* Email */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-ink-2">Email address</span>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-2" />
                <input
                  type="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendLink()}
                  className="w-full h-btn-sm pl-10 pr-4 rounded-xl border border-line bg-white font-body text-[15px] text-ink placeholder:text-ink-2/60 outline-none focus:border-brand transition-colors"
                />
              </div>
            </label>

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button onClick={sendLink} loading={loading} fullWidth size="lg">
              Continue with email
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step: link sent ───────────────────────────────────────────────────────
  if (step === 'sent') {
    return (
      <div className="min-h-dvh bg-white flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <TopBar onBack={() => { setStep('email'); setError('') }} />

        <div className="flex-1 flex flex-col px-6 pt-6 pb-8 gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading font-extrabold text-[28px] text-ink">Check your email</h1>
            <p className="text-[15px] text-ink-2 leading-relaxed">
              We sent a sign-in link to{' '}
              <span className="font-semibold text-ink">{email}</span>.
              Tap it and you&apos;ll be signed in automatically.
            </p>
            <p className="text-[14px] text-ink-2 mt-1">Not there? Check your spam folder.</p>
          </div>

          {resendSeconds > 0 ? (
            <p className="text-[15px] text-ink-2">
              Resend in{' '}
              <span className="font-semibold text-ink">
                {Math.floor(resendSeconds / 60)}:{String(resendSeconds % 60).padStart(2, '0')}
              </span>
            </p>
          ) : (
            <button
              type="button"
              onClick={sendLink}
              disabled={loading}
              className="text-[15px] font-semibold text-brand self-start disabled:opacity-60"
            >
              Resend link
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Step: profile completion ───────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-white flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center px-4 pt-4 pb-2" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
        <div className="w-11" />
      </div>

      <div className="flex-1 flex flex-col px-6 pt-4 pb-8 gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading font-extrabold text-[28px] text-ink">Complete your profile</h1>
          <p className="text-[15px] text-ink-2 leading-relaxed">
            Just your name and phone so we can contact you about deliveries.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <Input
            label="Full name"
            placeholder="e.g. Adewale Okafor"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <Input
            label="Phone number"
            type="tel"
            inputMode="tel"
            placeholder="e.g. 08012345678"
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>

        <div className="mt-auto">
          <Button onClick={saveProfile} loading={loading} fullWidth size="lg">
            Continue
          </Button>
        </div>
      </div>
    </div>
  )
}
