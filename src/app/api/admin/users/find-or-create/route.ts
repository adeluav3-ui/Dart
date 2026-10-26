import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UserRole } from '@/types/database'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, role } = await req.json() as { email: string; role: UserRole }
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Try to find existing user by email in auth
  const { data: userList } = await admin.auth.admin.listUsers()
  const existing = userList.users.find(u => u.email === email.toLowerCase())

  if (existing) {
    // Update role in profiles
    await admin.from('profiles').upsert({
      id: existing.id,
      role,
    }).eq('id', existing.id)
    return NextResponse.json({ userId: existing.id })
  }

  // Create new auth user (they log in with email OTP)
  const { data: newUser, error } = await admin.auth.admin.createUser({
    email: email.toLowerCase(),
    email_confirm: true,
    user_metadata: { role },
  })

  if (error || !newUser.user) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create user' }, { status: 500 })
  }

  return NextResponse.json({ userId: newUser.user.id })
}
