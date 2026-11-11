import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { singleTransfer } from '@/lib/monnify'

const MIN_KOBO = 50_000 // ₦500 minimum withdrawal

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()

  // Determine if vendor or rider and load their payout account
  const [{ data: vendor }, { data: rider }] = await Promise.all([
    admin.from('vendors')
      .select('id, payout_bank, payout_bank_code, payout_account_no, payout_account_name')
      .eq('owner_id', user.id)
      .single(),
    admin.from('riders')
      .select('id, payout_bank, payout_bank_code, payout_account_no, payout_account_name')
      .eq('id', user.id)
      .single(),
  ])

  let partyType: 'vendor' | 'rider'
  let bankCode: string
  let bankName: string
  let accountNo: string
  let accountName: string

  if (vendor?.payout_bank_code && vendor.payout_account_no) {
    partyType   = 'vendor'
    bankCode    = vendor.payout_bank_code
    bankName    = vendor.payout_bank ?? ''
    accountNo   = vendor.payout_account_no
    accountName = vendor.payout_account_name ?? ''
  } else if (rider?.payout_bank_code && rider.payout_account_no) {
    partyType   = 'rider'
    bankCode    = rider.payout_bank_code
    bankName    = rider.payout_bank ?? ''
    accountNo   = rider.payout_account_no
    accountName = rider.payout_account_name ?? ''
  } else {
    return NextResponse.json(
      { error: 'No payout account set up. Please add your bank details first, then re-select your bank from the dropdown to save the bank code.' },
      { status: 400 }
    )
  }

  // Load unsettled earning entries not already tagged with an in-flight payout
  const { data: entries } = await admin
    .from('ledger_entries')
    .select('id, amount')
    .eq('party_type', partyType)
    .eq('party_id', user.id)
    .eq('kind', 'earning')
    .is('settled_at', null)
    .is('payout_ref', null)

  const total = (entries ?? []).reduce((s: number, e: { amount: number }) => s + e.amount, 0)

  if (total < MIN_KOBO) {
    return NextResponse.json(
      { error: total === 0 ? 'No pending earnings to withdraw.' : `Minimum withdrawal is ₦500. You have ₦${(total / 100).toLocaleString('en-NG')} pending.` },
      { status: 400 }
    )
  }

  const reference = `GC-PAY-${user.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
  const ids = (entries ?? []).map((e: { id: string }) => e.id)

  // Call Monnify Single Transfer
  let result
  try {
    result = await singleTransfer({
      amountKobo:               total,
      reference,
      narration:                'GoCart earnings payout',
      destinationBankCode:      bankCode,
      destinationAccountNumber: accountNo,
      destinationAccountName:   accountName,
    })
  } catch (err) {
    console.error('Monnify transfer error:', err)
    return NextResponse.json({ error: 'Transfer failed. Please try again.' }, { status: 502 })
  }

  if (result.status === 'FAILED') {
    return NextResponse.json({ error: 'Transfer was declined by the bank. Check your account details.' }, { status: 400 })
  }

  if (result.status === 'SUCCESS') {
    // Synchronous success — settle immediately and send email
    await admin
      .from('ledger_entries')
      .update({ settled_at: new Date().toISOString(), payout_ref: reference, note: `Paid via Monnify: ${reference}` })
      .in('id', ids)

    const { data: authUser } = await admin.auth.admin.getUserById(user.id)
    const recipientEmail = authUser?.user?.email ?? ''
    const { data: profile } = await admin.from('profiles').select('full_name').eq('id', user.id).single()

    await admin.rpc('enqueue_notification', {
      p_event:             'payout',
      p_order_id:          null,
      p_recipient_user_id: user.id,
      p_recipient_email:   recipientEmail,
      p_recipient_role:    partyType,
      p_channel:           'email',
      p_title:             'Payout sent',
      p_body:              `Your payout of ₦${(total / 100).toLocaleString('en-NG')} has been sent.`,
      p_email_subject:     `GoCart payout: ₦${(total / 100).toLocaleString('en-NG')}`,
      p_email_template:    'payout',
      p_payload:           {
        recipient_name: (profile as { full_name?: string } | null)?.full_name ?? '',
        amount:         total,
        order_count:    ids.length,
        bank_name:      bankName,
        account_name:   accountName,
        reference,
      },
      p_dedupe_key: `payout:${reference}`,
    }).then(() => null, () => null)
  } else {
    // PENDING — tag entries so they can't be double-withdrawn; webhook will settle them
    await admin
      .from('ledger_entries')
      .update({ payout_ref: reference })
      .in('id', ids)
  }

  return NextResponse.json({ ok: true, amount: total, reference, status: result.status })
}
