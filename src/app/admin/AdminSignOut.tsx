'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function AdminSignOut() {
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className="text-xs font-semibold text-[#B9BEC4] hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
    >
      Sign out
    </button>
  )
}
