import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? url.searchParams.get('redirect') ?? '/home'

  if (!code) {
    return NextResponse.redirect(new URL('/home', req.url))
  }

  // We must attach session cookies to the redirect response the browser receives.
  // Use the mutable-response pattern from middleware so setAll() can stamp cookies
  // onto the right response object rather than losing them on a discarded context.
  let redirectTarget = new URL(next, req.url)
  let response = NextResponse.redirect(redirectTarget)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // Mirror onto request so subsequent getUser() calls in this handler see them
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          // Rebuild response (same URL) and stamp session cookies onto it
          response = NextResponse.redirect(redirectTarget)
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.exchangeCodeForSession(code)

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/home', req.url))
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, roles, last_dashboard')
    .eq('id', user.id)
    .single()

  // Determine final destination
  let destination: URL

  if (!profile?.full_name || !profile?.phone) {
    destination = new URL('/complete-profile', req.url)
    destination.searchParams.set('next', next)
    const googleName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? ''
    if (googleName) destination.searchParams.set('name', googleName)
  } else {
    const roles: string[] = profile?.roles ?? ['customer']
    const lastDash = profile?.last_dashboard
    if (lastDash && roles.some(r => r !== 'customer')) {
      destination = new URL(lastDash, req.url)
    } else if (roles.includes('admin')) {
      destination = new URL('/admin', req.url)
    } else if (roles.includes('vendor')) {
      destination = new URL('/vendor', req.url)
    } else if (roles.includes('rider')) {
      destination = new URL('/rider', req.url)
    } else {
      destination = new URL(next, req.url)
    }
  }

  // Build final response with correct destination, copying session cookies
  // that were stamped onto `response` during exchangeCodeForSession
  const finalResponse = NextResponse.redirect(destination)
  response.cookies.getAll().forEach(({ name, value, ...rest }) => {
    finalResponse.cookies.set(name, value, rest as CookieOptions)
  })
  return finalResponse
}
