import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/home'

  if (!token_hash || !type) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Invalid sign-in link')}`)
  }

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.verifyOtp({ token_hash, type })
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
  }

  // Session is now written to cookies. Determine where to send the user.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, roles, last_dashboard')
    .eq('id', user.id)
    .single()

  // New or incomplete profile — collect name + phone first
  if (!profile?.full_name || !profile?.phone) {
    const params = new URLSearchParams({ next })
    const googleName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? ''
    if (googleName) params.set('name', googleName)
    return NextResponse.redirect(`${origin}/complete-profile?${params.toString()}`)
  }

  // Route by role
  const roles: string[] = profile.roles ?? ['customer']
  const lastDash: string | null = profile.last_dashboard ?? null

  let destination: string
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

  return NextResponse.redirect(`${origin}${destination}`)
}
