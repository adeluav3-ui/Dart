import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // If a Supabase OAuth code lands on the wrong page (Site URL misconfiguration),
  // forward it to the real callback handler instead of breaking silently.
  const oauthCode = searchParams.get('code')
  if (oauthCode && pathname !== '/auth/callback' && !pathname.startsWith('/api/')) {
    const dest = request.nextUrl.clone()
    dest.pathname = '/auth/callback'
    return NextResponse.redirect(dest)
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  function redirectTo(path: string) {
    const url = request.nextUrl.clone()
    url.pathname = path
    return NextResponse.redirect(url)
  }

  function loginRedirect() {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Skip the complete-profile page itself to avoid infinite loops
  const isCompleteProfile = pathname === '/complete-profile'

  // ── Logged-in user hitting /login or /welcome → send to role home ──────────
  if (user && (pathname === '/login' || pathname === '/welcome')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, roles, last_dashboard, full_name, phone')
      .eq('id', user.id)
      .single()

    if (!profile?.full_name || !profile?.phone) {
      return redirectTo('/complete-profile')
    }

    // Honour ?next= for the sell-page → apply flow so already-authenticated
    // users land on the application form rather than their role dashboard.
    const next = searchParams.get('next') || ''
    if (next.startsWith('/account/apply/') && !next.includes('..')) {
      return redirectTo(next)
    }

    const roles: string[] = profile?.roles ?? (profile?.role ? [profile.role] : ['customer'])
    const lastDash = profile?.last_dashboard

    // Use last_dashboard if they have multiple non-customer roles
    if (lastDash && roles.includes(lastDash.replace('/', ''))) {
      return redirectTo(lastDash)
    }
    if (roles.includes('admin'))  return redirectTo('/admin')
    if (roles.includes('vendor')) return redirectTo('/vendor')
    if (roles.includes('rider'))  return redirectTo('/rider')
    return redirectTo('/home')
  }

  // ── Routes that require any logged-in user ────────────────────────────────
  const AUTH_REQUIRED = ['/checkout', '/orders', '/account', '/wallet', '/rate/']
  if (!user && AUTH_REQUIRED.some(p => pathname.startsWith(p))) {
    return loginRedirect()
  }

  // ── Complete-profile gate ─────────────────────────────────────────────────
  const PROFILE_GATED = ['/home', '/checkout', '/orders', '/account']
  if (user && !isCompleteProfile && PROFILE_GATED.some(p => pathname.startsWith(p))) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', user.id)
      .single()

    if (!profile?.full_name || !profile?.phone) {
      const url = request.nextUrl.clone()
      url.pathname = '/complete-profile'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }

  // ── Role-protected routes ─────────────────────────────────────────────────
  const isVendorDash =
    pathname === '/vendor' ||
    pathname.startsWith('/vendor/orders') ||
    pathname.startsWith('/vendor/menu') ||
    pathname.startsWith('/vendor/earnings') ||
    pathname.startsWith('/vendor/shop')

  const isRiderDash = pathname === '/rider' || pathname.startsWith('/rider/')
  const isAdminDash = pathname === '/admin' || pathname.startsWith('/admin/')

  if (isVendorDash || isRiderDash || isAdminDash) {
    if (!user) return loginRedirect()

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, roles')
      .eq('id', user.id)
      .single()
    const roles: string[] = profile?.roles ?? (profile?.role ? [profile.role] : [])

    if (isAdminDash && !roles.includes('admin')) {
      if (roles.includes('vendor')) return redirectTo('/vendor')
      if (roles.includes('rider'))  return redirectTo('/rider')
      return redirectTo('/home')
    }
    if (isVendorDash && !roles.includes('vendor') && !roles.includes('admin')) {
      if (roles.includes('rider')) return redirectTo('/rider')
      return redirectTo('/home')
    }
    if (isRiderDash && !roles.includes('rider') && !roles.includes('admin')) {
      if (roles.includes('vendor')) return redirectTo('/vendor')
      return redirectTo('/home')
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
