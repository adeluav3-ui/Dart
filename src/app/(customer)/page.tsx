'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SplashPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<'in' | 'out'>('in')
  const navigated = useRef(false)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const alreadySeen = sessionStorage.getItem('dart_splash_seen')

    async function go() {
      if (navigated.current) return
      navigated.current = true

      const welcomed = localStorage.getItem('dart_welcomed')
      if (!welcomed) {
        router.replace('/welcome')
        return
      }

      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          const role = profile?.role
          if (role === 'vendor') { router.replace('/vendor'); return }
          if (role === 'rider') { router.replace('/rider'); return }
          if (role === 'admin') { router.replace('/admin'); return }
        }
      } catch { /* not logged in or DB not ready */ }

      router.replace('/home')
    }

    // Skip animation if already seen this session or reduced motion
    if (alreadySeen || prefersReduced) {
      go()
      return
    }

    sessionStorage.setItem('dart_splash_seen', '1')

    const fadeOut = setTimeout(() => setPhase('out'), 1200)
    const nav = setTimeout(go, 1500)
    return () => { clearTimeout(fadeOut); clearTimeout(nav) }
  }, [router])

  return (
    <div
      className={`fixed inset-0 bg-brand flex flex-col items-center justify-center transition-opacity duration-300 ${
        phase === 'out' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Logo + wordmark */}
      <div className="flex items-center gap-3 animate-splash-logo">
        <svg width="52" height="52" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="50" cy="74" r="32" fill="none" stroke="white" strokeWidth="14" />
          <circle cx="50" cy="74" r="10" fill="#F26A1B" className="animate-splash-dot" />
          <polygon points="82,24 96,12 96,113 82,113" fill="white" />
        </svg>
        <span
          className="font-heading font-extrabold text-[52px] leading-none tracking-tight text-white animate-splash-text"
          style={{ marginTop: -6 }}
        >
          dart
        </span>
      </div>

      {/* Tagline */}
      <p
        className="absolute text-white/70 text-[15px] font-body tracking-wide animate-splash-text"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 48px)' }}
      >
        Anything nearby, delivered
      </p>
    </div>
  )
}
