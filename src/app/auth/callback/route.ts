import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') || url.searchParams.get('redirect') || '/home'

  if (code) {
    const supabase = createClient()
    await supabase.auth.exchangeCodeForSession(code)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, roles, last_dashboard')
        .eq('id', user.id)
        .single()

      // Gate: must complete profile before continuing
      if (!profile?.full_name || !profile?.phone) {
        const completeUrl = new URL('/complete-profile', req.url)
        completeUrl.searchParams.set('next', next)
        // Pre-fill name from Google if available
        const googleName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? ''
        if (googleName) completeUrl.searchParams.set('name', googleName)
        return NextResponse.redirect(completeUrl)
      }

      const roles: string[] = profile?.roles ?? ['customer']
      const lastDash = profile?.last_dashboard

      // Use last_dashboard for multi-role users
      if (lastDash && roles.some(r => r !== 'customer')) {
        return NextResponse.redirect(new URL(lastDash, req.url))
      }
      if (roles.includes('admin'))  return NextResponse.redirect(new URL('/admin', req.url))
      if (roles.includes('vendor')) return NextResponse.redirect(new URL('/vendor', req.url))
      if (roles.includes('rider'))  return NextResponse.redirect(new URL('/rider', req.url))

      return NextResponse.redirect(new URL(next, req.url))
    }
  }

  return NextResponse.redirect(new URL(next, req.url))
}
