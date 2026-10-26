import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendAdminNoRiderEmail } from '@/lib/email'

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { vendorName, orderCode } = await req.json()

  await sendAdminNoRiderEmail({ vendorName, orderCode })

  return NextResponse.json({ ok: true })
}
