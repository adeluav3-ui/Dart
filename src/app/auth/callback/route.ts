import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? url.searchParams.get('redirect') ?? '/home'

  if (!code) {
    return NextResponse.redirect(new URL('/home', req.url))
  }

  // Hand off to the client-side confirm page so the browser's own Supabase client
  // can exchange the code. This guarantees the PKCE code_verifier (stored in the
  // browser's cookies when sign-in was initiated) is always accessible — server-side
  // exchange can miss it when the link is opened from an email app in a different
  // browser context.
  const confirmUrl = new URL('/auth/confirm', req.url)
  confirmUrl.searchParams.set('code', code)
  confirmUrl.searchParams.set('next', next)
  return NextResponse.redirect(confirmUrl)
}
