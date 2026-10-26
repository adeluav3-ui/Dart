import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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
  const { pathname } = request.nextUrl

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

  // ── Logged-in user hitting /login or /welcome → send to role home ──────────
  if (user && (pathname === '/login' || pathname === '/welcome')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = profile?.role
    if (role === 'vendor') return redirectTo('/vendor')
    if (role === 'rider')  return redirectTo('/rider')
    if (role === 'admin')  return redirectTo('/admin')
    return redirectTo('/home')
  }

  // ── Routes that require any logged-in user ────────────────────────────────
  const AUTH_REQUIRED = ['/checkout', '/orders', '/account', '/wallet', '/rate/']
  if (!user && AUTH_REQUIRED.some(p => pathname.startsWith(p))) {
    return loginRedirect()
  }

  // ── Role-protected routes ─────────────────────────────────────────────────
  const isVendorDash =
    pathname === '/vendor' ||
    pathname.startsWith('/vendor/orders') ||
    pathname.startsWith('/vendor/menu') ||
    pathname.startsWith('/vendor/earnings')

  const isRiderDash = pathname === '/rider' || pathname.startsWith('/rider/')
  const isAdminDash = pathname === '/admin' || pathname.startsWith('/admin/')

  if (isVendorDash || isRiderDash || isAdminDash) {
    if (!user) return loginRedirect()

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = profile?.role

    if (isAdminDash && role !== 'admin') {
      return redirectTo(role === 'vendor' ? '/vendor' : role === 'rider' ? '/rider' : '/home')
    }
    if (isVendorDash && role !== 'vendor' && role !== 'admin') {
      return redirectTo(role === 'rider' ? '/rider' : '/home')
    }
    if (isRiderDash && role !== 'rider' && role !== 'admin') {
      return redirectTo(role === 'vendor' ? '/vendor' : '/home')
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
