import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text()
    const body = JSON.parse(raw)

    // Verify signature — same scheme as payment webhook
    const signature = req.headers.get('monnify-signature') ?? ''
    const secretKey = process.env.MONNIFY_SECRET_KEY!
    const computed = createHmac('sha512', secretKey).update(raw).digest('hex')

    if (computed !== signature) {
      console.error('Monnify disbursement webhook: invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const { eventType, eventData } = body as {
      eventType: string
      eventData: {
        reference: string
        amount: number
        bankName?: string
        destinationBankName?: string
      }
    }

    if (eventType !== 'SUCCESSFUL_DISBURSEMENT' && eventType !== 'FAILED_DISBURSEMENT') {
      return NextResponse.json({ received: true })
    }

    const { reference } = eventData
    if (!reference) {
      console.error('Disbursement webhook: missing reference')
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Find the earning entries tagged with this payout reference
    const { data: entries } = await admin
      .from('ledger_entries')
      .select('id, amount, party_type, party_id, settled_at')
      .eq('payout_ref', reference)
      .eq('kind', 'earning')

    if (!entries || entries.length === 0) {
      // Already processed or unknown reference — acknowledge idempotently
      return NextResponse.json({ received: true })
    }

    const ids = entries.map((e: { id: string }) => e.id)
    const partyId: string = entries[0].party_id
    const partyType: string = entries[0].party_type
    const total = entries.reduce((s: number, e: { amount: number }) => s + e.amount, 0)

    if (eventType === 'SUCCESSFUL_DISBURSEMENT') {
      // Idempotency guard — skip if already settled
      const unsettled = entries.filter((e: { settled_at: string | null }) => !e.settled_at)
      if (unsettled.length === 0) return NextResponse.json({ received: true })

      await admin
        .from('ledger_entries')
        .update({ settled_at: new Date().toISOString(), note: `Paid via Monnify: ${reference}` })
        .in('id', ids)

      // Send payout email
      const { data: authUser } = await admin.auth.admin.getUserById(partyId)
      const recipientEmail = authUser?.user?.email ?? ''
      if (!recipientEmail) return NextResponse.json({ received: true })

      const { data: profile } = await admin
        .from('profiles').select('full_name').eq('id', partyId).single()

      // Look up bank name from vendor or rider table
      let bankName = eventData.destinationBankName ?? eventData.bankName ?? ''
      if (!bankName) {
        if (partyType === 'vendor') {
          const { data: v } = await admin.from('vendors').select('payout_bank').eq('owner_id', partyId).single()
          bankName = (v as { payout_bank?: string } | null)?.payout_bank ?? ''
        } else {
          const { data: r } = await admin.from('riders').select('payout_bank').eq('id', partyId).single()
          bankName = (r as { payout_bank?: string } | null)?.payout_bank ?? ''
        }
      }

      await admin.rpc('enqueue_notification', {
        p_event:             'payout',
        p_order_id:          null,
        p_recipient_user_id: partyId,
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
          reference,
        },
        p_dedupe_key: `payout:${reference}`,
      }).then(() => null, () => null)

    } else {
      // FAILED_DISBURSEMENT — clear payout_ref so entries are eligible for next withdrawal
      await admin
        .from('ledger_entries')
        .update({ payout_ref: null })
        .in('id', ids)

      // Notify the user that their payout failed
      const { data: authUser } = await admin.auth.admin.getUserById(partyId)
      const recipientEmail = authUser?.user?.email ?? ''
      if (recipientEmail) {
        const { data: profile } = await admin
          .from('profiles').select('full_name').eq('id', partyId).single()

        let bankName = eventData.destinationBankName ?? eventData.bankName ?? ''
        if (!bankName) {
          if (partyType === 'vendor') {
            const { data: v } = await admin.from('vendors').select('payout_bank').eq('owner_id', partyId).single()
            bankName = (v as { payout_bank?: string } | null)?.payout_bank ?? ''
          } else {
            const { data: r } = await admin.from('riders').select('payout_bank').eq('id', partyId).single()
            bankName = (r as { payout_bank?: string } | null)?.payout_bank ?? ''
          }
        }

        await admin.rpc('enqueue_notification', {
          p_event:             'payout_failed',
          p_order_id:          null,
          p_recipient_user_id: partyId,
          p_recipient_email:   recipientEmail,
          p_recipient_role:    partyType,
          p_channel:           'email',
          p_title:             'Payout failed',
          p_body:              `Your payout of ₦${(total / 100).toLocaleString('en-NG')} could not be completed. Please try again.`,
          p_email_subject:     `GoCart payout failed: ₦${(total / 100).toLocaleString('en-NG')}`,
          p_email_template:    'payout_failed',
          p_payload:           {
            recipient_name: (profile as { full_name?: string } | null)?.full_name ?? '',
            amount:         total,
            bank_name:      bankName,
            reference,
          },
          p_dedupe_key: `payout_failed:${reference}`,
        }).then(() => null, () => null)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Monnify disbursement webhook error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
