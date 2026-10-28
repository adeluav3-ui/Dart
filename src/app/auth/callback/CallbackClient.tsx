'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  code: string | undefined
  next: string
}

export function CallbackClient({ code, next }: Props) {
  const [error, setError] = useState('')

  useEffect(() => {
    async function handleCallback() {
      const supabase = createClient()

      if (code) {
        // PKCE flow: exchange the code for a session
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeErr) {
          setError(exchangeErr.message)
          return
        }
      }
      // Implicit flow: createBrowserClient detects #access_token=… in the URL
      // automatically (detectSessionInUrl: true is the default). Give it a tick
      // to process before we read the user.
      await new Promise(r => setTimeout(r, 100))

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login'
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, roles, last_dashboard')
        .eq('id', user.id)
        .single()

      let destination: string

      if (!profile?.full_name || !profile?.phone) {
        const params = new URLSearchParams({ next })
        const googleName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? ''
        if (googleName) params.set('name', googleName)
        destination = '/complete-profile?' + params.toString()
      } else {
        const roles: string[] = profile.roles ?? ['customer']
        const lastDash = profile.last_dashboard

        if (lastDash && roles.some(r => r !== 'customer')) {
          destination = lastDash
        } else if (roles.includes('admin')) {
          destination = '/admin'
        } else if (roles.includes('vendor')) {
          destination = '/vendor'
        } else if (roles.includes('rider')) {
          destination = '/rider'
        } else {
          destination = next
        }
      }

      // Full page reload so the server gets a completely fresh request
      // with the session cookies the browser just stored.
      window.location.href = destination
    }

    handleCallback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) {
    return (
      <div className="min-h-dvh bg-canvas flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-body text-[15px] text-danger">{error}</p>
        <a href="/login" className="font-bold text-brand text-[15px]">Back to sign in</a>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-canvas flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-brand/20 border-t-brand animate-spin" />
    </div>
  )
}
