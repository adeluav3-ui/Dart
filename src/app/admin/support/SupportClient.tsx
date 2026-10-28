'use client'

import { useState } from 'react'
import type { SupportTicketStatus } from '@/types/database'

interface TicketRow {
  id: string
  user_id: string | null
  order_id: string | null
  subject: string
  body: string
  status: SupportTicketStatus
  admin_note: string | null
  created_at: string
  updated_at: string
  customer_name: string | null
  customer_phone: string | null
  order_code: string | null
}

interface Props {
  initialTickets: TicketRow[]
}

type TabFilter = 'open' | 'resolved' | 'closed' | 'all'

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-warn-tint text-warn',
  resolved: 'bg-brand-tint text-brand-ink',
  closed: 'bg-surface text-ink-2',
}

export function SupportClient({ initialTickets }: Props) {
  const [tickets, setTickets] = useState(initialTickets)
  const [tab, setTab] = useState<TabFilter>('open')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const visible = tickets.filter(t => tab === 'all' || t.status === tab)

  async function updateTicket(id: string, status: SupportTicketStatus, admin_note: string) {
    setSaving(id)
    const res = await fetch(`/api/admin/support/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, admin_note }),
    })
    if (res.ok) {
      const json = await res.json()
      setTickets(prev => prev.map(t => t.id === id ? { ...t, ...json.updated } : t))
    }
    setSaving(null)
  }

  function noteFor(t: TicketRow) {
    return notes[t.id] ?? (t.admin_note ?? '')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-xl">Support messages</h2>
        <span className="text-[13px] text-ink-2">{tickets.filter(t => t.status === 'open').length} open</span>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['open', 'resolved', 'closed', 'all'] as TabFilter[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-[13px] font-semibold capitalize ${
              tab === t ? 'bg-ink text-white' : 'bg-white text-ink-2'
            }`}
          >
            {t === 'all' ? 'All' : t}
            <span className="ml-1 opacity-60">
              {tickets.filter(tk => t === 'all' ? true : tk.status === t).length}
            </span>
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center text-ink-2">No messages here.</div>
      )}

      {visible.map(ticket => {
        const isOpen = expanded === ticket.id
        return (
          <div key={ticket.id} className="bg-white rounded-2xl p-4 flex flex-col gap-3">
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="font-bold text-[15px]">{ticket.customer_name ?? 'Unknown customer'}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${STATUS_COLOR[ticket.status] ?? ''}`}>
                    {ticket.status}
                  </span>
                </div>
                {ticket.customer_phone && (
                  <a href={`tel:${ticket.customer_phone}`} className="text-[13px] text-brand block">
                    {ticket.customer_phone}
                  </a>
                )}
                {ticket.order_code && (
                  <span className="text-[12px] text-ink-2">Order #{ticket.order_code}</span>
                )}
                <p className="text-[12px] text-ink-2 mt-0.5">
                  {new Date(ticket.created_at).toLocaleDateString('en-NG', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : ticket.id)}
                className="h-8 px-3 rounded-lg bg-surface text-[12px] font-semibold shrink-0"
              >
                {isOpen ? 'Hide' : 'Reply'}
              </button>
            </div>

            {/* Subject + body */}
            <div className="bg-surface rounded-xl p-3 flex flex-col gap-1">
              <p className="text-[13px] font-semibold text-ink">{ticket.subject}</p>
              <p className="text-[13px] text-ink-2 leading-relaxed whitespace-pre-wrap">{ticket.body}</p>
            </div>

            {/* Existing admin note */}
            {ticket.admin_note && !isOpen && (
              <div className="bg-brand-tint rounded-xl px-3 py-2 text-[12px] text-brand-ink">
                <span className="font-semibold">Your note: </span>{ticket.admin_note}
              </div>
            )}

            {/* Reply/update panel */}
            {isOpen && (
              <div className="flex flex-col gap-2.5">
                <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
                  Note to customer (optional — shown on their help page)
                  <textarea
                    value={noteFor(ticket)}
                    onChange={e => setNotes(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                    placeholder="e.g. We've looked into this and will process your refund within 24 hours."
                    rows={3}
                    className="px-3 py-2 rounded-xl border border-line font-body text-[13px] text-ink resize-none focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </label>
                <div className="flex gap-2">
                  {ticket.status === 'open' && (
                    <button
                      type="button"
                      disabled={saving === ticket.id}
                      onClick={() => updateTicket(ticket.id, 'resolved', noteFor(ticket))}
                      className="flex-1 h-9 rounded-xl bg-brand text-white text-[13px] font-bold border-0 disabled:opacity-50"
                    >
                      {saving === ticket.id ? 'Saving…' : 'Mark resolved'}
                    </button>
                  )}
                  {ticket.status === 'resolved' && (
                    <button
                      type="button"
                      disabled={saving === ticket.id}
                      onClick={() => updateTicket(ticket.id, 'closed', noteFor(ticket))}
                      className="flex-1 h-9 rounded-xl border border-line bg-white text-[13px] font-bold text-ink-2 disabled:opacity-50"
                    >
                      {saving === ticket.id ? 'Saving…' : 'Close'}
                    </button>
                  )}
                  {ticket.status === 'closed' && (
                    <button
                      type="button"
                      disabled={saving === ticket.id}
                      onClick={() => updateTicket(ticket.id, 'open', noteFor(ticket))}
                      className="flex-1 h-9 rounded-xl border border-line bg-white text-[13px] font-bold text-ink-2 disabled:opacity-50"
                    >
                      {saving === ticket.id ? 'Saving…' : 'Reopen'}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={saving === ticket.id}
                    onClick={() => updateTicket(ticket.id, ticket.status, noteFor(ticket))}
                    className="flex-1 h-9 rounded-xl border border-line bg-white text-[13px] font-bold text-ink disabled:opacity-50"
                  >
                    {saving === ticket.id ? 'Saving…' : 'Save note'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
