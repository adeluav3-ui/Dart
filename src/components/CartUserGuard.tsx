'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/store/cart'

export function CartUserGuard() {
  const { claimCart } = useCart()

  useEffect(() => {
    const supabase = createClient()

    // Only claim on login — never call claimCart(null) on logout.
    // The cart stays in localStorage so the same user gets it back on next login.
    // A different user logging in will hit the "different userId" branch and clear it.
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) claimCart(data.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) claimCart(session.user.id)
    })

    return () => subscription.unsubscribe()
  }, [claimCart])

  return null
}
