import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('roles').eq('id', user.id).single()
  if (!profile?.roles?.includes('admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: target } = await admin.from('profiles').select('roles').eq('id', userId).single()
  const existing: string[] = target?.roles ?? ['customer']
  const newRoles = Array.from(new Set([...existing, 'rider']))
  const newRole = newRoles.includes('admin') ? 'admin' : newRoles.includes('vendor') ? 'vendor' : 'rider'
  const { error } = await admin
    .from('profiles')
    .update({ roles: newRoles, role: newRole })
    .eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
