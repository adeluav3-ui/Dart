'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DartLogo } from '@/components/ui/DartLogo'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Mail, ArrowRight } from 'lucide-react'

export function LoginForm() {
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const supabase = createClient()

  async function sendCode() {
    setError('')
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setStep('otp')
    }
  }

  async function verifyCode() {
    setError('')
    if (otp.length < 6) {
      setError('Enter the 6-digit code we sent you')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otp,
      type: 'email',
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      router.push(redirect)
      router.refresh()
    }
  }

  async function signInWithGoogle() {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <DartLogo className="justify-center" />

        <div className="bg-white rounded-2xl p-6 flex flex-col gap-6 shadow-sm">
          {step === 'email' ? (
            <>
              <div className="flex flex-col gap-1">
                <h1 className="font-heading font-extrabold text-2xl text-ink">Sign in</h1>
                <p className="text-sm text-ink-2">Continue with Google or get a code by email</p>
              </div>

              <Button
                onClick={signInWithGoogle}
                loading={googleLoading}
                fullWidth
                size="lg"
                variant="secondary"
              >
                <svg className="mr-2" width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </Button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-line" />
                <span className="text-xs text-ink-2">or</span>
                <div className="flex-1 h-px bg-line" />
              </div>

              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-ink-2">Email address</span>
                  <div className="relative">
                    <Mail
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-2"
                    />
                    <input
                      type="email"
                      inputMode="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendCode()}
                      className="w-full h-btn-sm pl-9 pr-3 rounded-xl border border-line bg-white font-body text-[15px] text-ink placeholder:text-ink-2/60 outline-none focus:border-brand transition-colors"
                    />
                  </div>
                </label>
                {error && <p className="text-sm text-danger">{error}</p>}
                <Button onClick={sendCode} loading={loading} fullWidth size="lg">
                  Send code
                  <ArrowRight size={18} className="ml-2" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <h1 className="font-heading font-extrabold text-2xl text-ink">Enter code</h1>
                <p className="text-sm text-ink-2">Sent to {email}</p>
              </div>

              <div className="flex flex-col gap-4">
                <Input
                  label="6-digit code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && verifyCode()}
                />
                {error && <p className="text-sm text-danger">{error}</p>}
                <Button onClick={verifyCode} loading={loading} fullWidth size="lg">
                  Verify
                </Button>
                <button
                  type="button"
                  className="text-sm text-ink-2 underline underline-offset-2 self-center"
                  onClick={() => { setStep('email'); setOtp(''); setError('') }}
                >
                  Change email
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
