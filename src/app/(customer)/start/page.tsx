'use client'

export const dynamic = 'force-static'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function StartPage() {
  const router = useRouter()
  const started = useRef(false)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    async function getDestination(): Promise<string> {
      const welcomed = localStorage.getItem('dart_welcomed')
      if (!welcomed) return '/welcome'

      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('roles')
            .eq('id', user.id)
            .single()
          const roles: string[] = profile?.roles ?? []
          if (roles.includes('admin'))  return '/admin'
          if (roles.includes('vendor')) return '/vendor'
          if (roles.includes('rider'))  return '/rider'
        }
      } catch { /* not logged in */ }

      return '/home'
    }

    // Run the auth check and splash animation in parallel.
    // Redirect only after BOTH complete so the splash is never cut short.
    const authPromise = getDestination()
    const splashPromise = new Promise<void>(resolve => setTimeout(resolve, 1750))

    const fadeTimer = setTimeout(() => setFading(true), 1400)

    Promise.all([authPromise, splashPromise]).then(([dest]) => {
      router.replace(dest)
    })

    return () => clearTimeout(fadeTimer)
  }, [router])

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[9999] bg-brand flex flex-col items-center justify-center pointer-events-none transition-opacity duration-350 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-5">
        <svg width="96" height="84" viewBox="0 0 120 104" className="overflow-visible">
          <g className="animate-basket-slide">
            <path d="M8 16 H22 L28 30" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 46 H16 M6 58 H18 M10 70 H22" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" opacity="0.45" />
            <polygon points="28,30 112,30 99,76 40,76" fill="white" />
            <path d="M62 41 L76 53 L62 65" fill="none" stroke="#0B7A47" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <circle cx="50" cy="92" r="9" fill="#F26A1B" className="animate-wheel-pop" style={{ animationDelay: '0.5s' }} />
          <circle cx="90" cy="92" r="9" fill="#F26A1B" className="animate-wheel-pop" style={{ animationDelay: '0.62s' }} />
        </svg>

        <span
          className="font-heading font-extrabold text-[40px] leading-none tracking-tight text-white animate-splash-text"
          style={{ animationDelay: '0.85s' }}
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
