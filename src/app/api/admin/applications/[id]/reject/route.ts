import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('roles').eq('id', user.id).single()
  if (!profile?.roles?.includes('admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { note } = await req.json() as { note?: string }
  const admin = createAdminClient()

  const { error } = await admin
    .from('applications')
    .update({
      status: 'rejected',
      admin_note: note ?? null,
      decided_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .in('status', ['submitted', 'contacted'])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    updated: { status: 'rejected', admin_note: note ?? null, decided_at: new Date().toISOString() },
  })
}
