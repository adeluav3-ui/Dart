import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (callerProfile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // Fetch the target user's email and profile phone
  const [{ data: authUser }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(params.userId),
    admin.from('profiles').select('phone').eq('id', params.userId).single(),
  ])

  const email = authUser?.user?.email ?? null
  const phone = (profile as { phone?: string | null } | null)?.phone ?? null

  // Record the ban so this email/phone can never re-register
  await admin.from('banned_customers').insert({
    user_id: params.userId,
    email,
    phone,
    reason: 'Deleted by admin',
    banned_by: user.id,
  })

  // Permanently ban them from logging into their existing account via Supabase auth.
  // 876000 hours ≈ 100 years.
  await admin.auth.admin.updateUserById(params.userId, { ban_duration: '876000h' })

  return NextResponse.json({ ok: true })
}
