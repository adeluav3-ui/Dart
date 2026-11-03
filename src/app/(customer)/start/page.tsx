'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function StartPage() {
  const router = useRouter()
  const navigated = useRef(false)

  useEffect(() => {
    if (navigated.current) return
    navigated.current = true

    async function go() {
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
      } catch { /* not logged in */ }

      router.replace('/home')
    }

    go()
  }, [router])

  // bg-canvas prevents a white flash while the async redirect runs
  return <div className="fixed inset-0 bg-canvas" />
}
