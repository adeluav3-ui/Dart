import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendAdminApplicationEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { kind: string; data: Record<string, unknown> }
  const { kind, data } = body

  if (kind !== 'vendor' && kind !== 'rider') {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
  }

  // Check for existing open application
  const { data: existing } = await supabase
    .from('applications')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('kind', kind)
    .in('status', ['submitted', 'contacted'])
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'You already have a pending application' }, { status: 409 })
  }

  const { error } = await supabase.from('applications').insert({
    user_id: user.id,
    kind,
    data,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Email admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  await sendAdminApplicationEmail({
    kind: kind as 'vendor' | 'rider',
    applicantName: profile?.full_name ?? user.email ?? 'Unknown',
    data,
  }).catch(() => null)

  return NextResponse.json({ ok: true })
}
