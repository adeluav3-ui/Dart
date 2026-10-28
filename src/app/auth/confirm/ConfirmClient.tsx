'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  code: string
  next: string
}

export function ConfirmClient({ code, next }: Props) {
  const router = useRouter()

  useEffect(() => {
    async function confirm() {
      const supabase = createClient()

      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        router.replace('/login')
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, roles, last_dashboard')
        .eq('id', user.id)
        .single()

      if (!profile?.full_name || !profile?.phone) {
        const params = new URLSearchParams({ next })
        const googleName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? ''
        if (googleName) params.set('name', googleName)
        router.replace('/complete-profile?' + params.toString())
        return
      }

      const roles: string[] = profile.roles ?? ['customer']
      const lastDash = profile.last_dashboard

      if (lastDash && roles.some(r => r !== 'customer')) {
        router.replace(lastDash)
      } else if (roles.includes('admin')) {
        router.replace('/admin')
      } else if (roles.includes('vendor')) {
        router.replace('/vendor')
      } else if (roles.includes('rider')) {
        router.replace('/rider')
      } else {
        router.replace(next)
      }
    }

    confirm()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-dvh bg-canvas flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-brand/20 border-t-brand animate-spin" />
    </div>
  )
}
