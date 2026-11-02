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

    if (alreadySeen || prefersReduced) {
      go()
      return
    }

    sessionStorage.setItem('dart_splash_seen', '1')

    const nav = setTimeout(go, 1500)
    const fadeOut = setTimeout(() => setPhase('out'), 1700)
    return () => { clearTimeout(nav); clearTimeout(fadeOut) }
  }, [router])

  return (
    <div
      className={`fixed inset-0 bg-brand flex flex-col items-center justify-center transition-opacity duration-300 ${
        phase === 'out' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-5">
        {/* Inline symbol — basket slides in, wheels pop after */}
        <svg
          width="96"
          height="84"
          viewBox="0 0 120 104"
          aria-hidden="true"
          className="overflow-visible"
        >
          <g className="animate-basket-slide">
            <path d="M8 16 H22 L28 30" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 46 H16 M6 58 H18 M10 70 H22" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" opacity="0.45" />
            <polygon points="28,30 112,30 99,76 40,76" fill="white" />
            <path d="M62 41 L76 53 L62 65" fill="none" stroke="#0B7A47" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <circle cx="50" cy="92" r="9" fill="#F26A1B" className="animate-wheel-pop" style={{ animationDelay: '0.5s' }} />
          <circle cx="90" cy="92" r="9" fill="#F26A1B" className="animate-wheel-pop" style={{ animationDelay: '0.62s' }} />
        </svg>

        {/* Wordmark fades up after wheels */}
        <span
          className="font-heading font-extrabold text-[40px] leading-none tracking-tight text-white animate-splash-text"
          style={{ animationDelay: '0.85s' }}
          aria-label="GoCart"
        >
          gocart
        </span>
      </div>

      <p
        className="absolute text-white/70 text-[15px] font-body tracking-wide animate-splash-text"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 48px)', animationDelay: '1.1s' }}
      >
        Fill your cart. We&apos;ll go get it.
      </p>
    </div>
  )
}
