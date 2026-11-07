import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const to = user.email
  if (!to) {
    return NextResponse.json({ error: 'Admin account has no email address' }, { status: 400 })
  }

  const result = await sendEmail({
    to,
    subject: 'GoCart test email',
    text: 'If you can read this, GoCart email works.',
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: result.id })
}
