import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { RiderProfileClient } from './RiderProfileClient'

export const dynamic = 'force-dynamic'

export default async function RiderProfilePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  const [{ data: profile }, { data: rider }] = await Promise.all([
    supabase.from('profiles').select('full_name, phone').eq('id', user.id).single(),
    admin.from('riders')
      .select('bike_plate, payout_bank, payout_bank_code, payout_account_name, payout_account_no')
      .eq('id', user.id)
      .single(),
  ])

  return (
    <RiderProfileClient
      userId={user.id}
      fullName={profile?.full_name ?? ''}
      phone={profile?.phone ?? ''}
      bikePlate={rider?.bike_plate ?? null}
      payoutBankCode={rider?.payout_bank_code ?? ''}
      payoutBank={rider?.payout_bank ?? ''}
      payoutAccountName={rider?.payout_account_name ?? ''}
      payoutAccountNo={rider?.payout_account_no ?? ''}
    />
  )
}
