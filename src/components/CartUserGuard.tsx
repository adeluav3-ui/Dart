'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/store/cart'

export function CartUserGuard() {
  const { claimCart } = useCart()

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => {
      claimCart(data.user?.id ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      claimCart(session?.user?.id ?? null)
    })

    return () => subscription.unsubscribe()
  }, [claimCart])

  return null
}
