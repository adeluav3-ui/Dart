import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.redirect(new URL('/admin', req.url))

  const formData = await req.formData()
  const ids = (formData.get('entryIds') as string ?? '').split(',').filter(Boolean)

  const admin = createAdminClient()
  await admin
    .from('ledger_entries')
    .update({ settled_at: new Date().toISOString() })
    .in('id', ids)

  return NextResponse.redirect(new URL('/admin/money', req.url))
}
