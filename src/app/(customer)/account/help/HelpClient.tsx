'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Phone, Mail, ChevronRight, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import type { SupportTicket } from '@/types/database'

interface OrderRef { id: string; code: string; created_at: string }

interface Props {
  userId: string
  settings: Record<string, string>
  tickets: SupportTicket[]
  orders: OrderRef[]
  isAdmin: boolean
}

export function HelpClient({ userId, settings, tickets: initial, orders, isAdmin }: Props) {
  const router = useRouter()
  const [tickets, setTickets] = useState(initial)
  const [sheet, setSheet] = useState(false)
  const [orderId, setOrderId] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState('')
  const supabase = createClient()

  const phone = settings.support_phone ?? null
  const email = settings.support_email ?? 'support@gocartng.com'
  const hours = settings.support_hours ?? 'Mon – Sat · 8 am – 9 pm'

  function formatPhone(raw: string) {
    return raw.replace('+234', '+234 ').replace(/(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3')
  }

  async function submitTicket() {
    if (!body.trim()) return
    setSubmitting(true)
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: userId,
        order_id: orderId || null,
        subject: orderId ? 'Order problem' : 'Support request',
        body: body.trim(),
      })
      .select()
      .single()
    setSubmitting(false)
    if (error) { setToast('Could not send. Try again.'); return }
    if (data) setTickets(prev => [data as SupportTicket, ...prev])
    setBody('')
    setOrderId('')
    setSheet(false)
    setToast('Message sent')
  }

  const statusColor: Record<string, string> = {
    open: 'bg-warn-tint text-warn',
    resolved: 'bg-brand-tint text-brand-ink',
    closed: 'bg-surface text-ink-2',
  }

  return (
    <div className="min-h-dvh bg-canvas font-body text-ink"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>

      <header className="bg-white px-4 pt-5 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-surface flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-heading font-extrabold text-[20px] text-ink">Help and support</h1>
      </header>

      <div className="px-4 pt-4 flex flex-col gap-3">
        {/* Contact card */}
        <div className="bg-brand-tint rounded-2xl p-4 flex flex-col gap-3">
          {phone && (
            <a
              href={`tel:${phone}`}
              className="h-11 rounded-xl bg-brand text-white font-bold text-[15px] flex items-center justify-center gap-2 no-underline"
            >
              <Phone size={16} />
              Call us — {formatPhone(phone)}
            </a>
          )}
          <a
            href={`mailto:${email}`}
            className="h-11 rounded-xl bg-brand text-white font-bold text-[14px] flex items-center justify-center gap-2 no-underline"
          >
            <Mail size={16} />
            {email}
          </a>
          <p className="text-[12px] text-brand-ink/70 text-center">{hours}</p>
        </div>

        {/* Report a problem */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <button type="button" onClick={() => setSheet(true)}
            className="w-full flex items-center gap-3 px-4 py-4 text-left">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-ink">Report a problem</p>
              <p className="text-[12px] text-ink-2 mt-0.5">Issue with an order? Tell us.</p>
            </div>
            <ChevronRight size={18} className="text-ink-2 shrink-0" />
          </button>
        </div>

        {/* Tickets list */}
        {tickets.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[12px] font-semibold text-ink-2 px-1">
              {isAdmin ? 'All support messages' : 'Your messages'}
            </p>
            <div className="bg-white rounded-2xl overflow-hidden">
              {tickets.map((t, i) => (
                <div key={t.id}
                  className={`px-4 py-3.5 ${i < tickets.length - 1 ? 'border-b border-line' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[14px] font-semibold text-ink">{t.subject}</p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${statusColor[t.status] ?? ''}`}>
                      {t.status}
                    </span>
                  </div>
                  <p className="text-[13px] text-ink-2 mt-1 line-clamp-2">{t.body}</p>
                  {t.admin_note && (
                    <p className="text-[12px] text-brand-ink mt-2 bg-brand-tint rounded-lg px-3 py-2">
                      {t.admin_note}
                    </p>
                  )}
                  <p className="text-[11px] text-ink-2 mt-1.5">
                    {new Date(t.created_at).toLocaleDateString('en-NG', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Report sheet */}
      {sheet && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setSheet(false)} />
          <div
            className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-3xl max-w-md mx-auto flex flex-col"
            style={{ maxHeight: '88dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
              <span className="font-heading font-bold text-[17px]">Report a problem</span>
              <button type="button" onClick={() => setSheet(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-surface">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto px-5 pb-6 flex flex-col gap-3">
              {orders.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold text-ink-2">Order (optional)</label>
                  <select
                    value={orderId}
                    onChange={e => setOrderId(e.target.value)}
                    className="h-11 px-3 rounded-xl border border-line font-body text-[14px] text-ink bg-white"
                  >
                    <option value="">Select an order…</option>
                    {orders.map(o => (
                      <option key={o.id} value={o.id}>
                        #{o.code} — {new Date(o.created_at).toLocaleDateString('en-NG', {
                          day: 'numeric', month: 'short',
                        })}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-ink-2">Describe the problem</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Tell us what happened…"
                  rows={4}
                  className="px-3 py-2.5 rounded-xl border border-line font-body text-[14px] text-ink resize-none focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
              <Button
                onClick={submitTicket}
                loading={submitting}
                disabled={!body.trim()}
                fullWidth
                size="lg"
              >
                Send message
              </Button>
              <p className="text-[12px] text-ink-2 text-center leading-relaxed">
                See our{' '}
                <Link href="/refunds" className="text-brand underline-offset-2 hover:underline">
                  Refund Policy
                </Link>
                {' '}for what qualifies for a refund.
              </p>
            </div>
          </div>
        </>
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
    </div>
  )
}
