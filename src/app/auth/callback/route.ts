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
        .select('full_name, role')
        .eq('id', user.id)
        .single()

      if (!profile?.full_name) {
        const completeUrl = new URL('/login', req.url)
        completeUrl.searchParams.set('complete', '1')
        completeUrl.searchParams.set('next', next)
        return NextResponse.redirect(completeUrl)
      }

      const role = profile?.role
      const home =
        role === 'vendor' ? '/vendor' :
        role === 'rider'  ? '/rider'  :
        role === 'admin'  ? '/admin'  :
        next

      return NextResponse.redirect(new URL(home, req.url))
    }
  }

  return NextResponse.redirect(new URL(next, req.url))
}
