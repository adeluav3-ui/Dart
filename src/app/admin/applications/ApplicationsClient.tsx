'use client'

import { useState } from 'react'
import type { Application } from '@/types/database'

interface AppRow extends Application {
  applicant_name: string
  applicant_phone: string | null
}

interface Props {
  initialApps: AppRow[]
}

type TabFilter = 'all' | 'submitted' | 'contacted' | 'approved' | 'rejected'
type KindFilter = 'all' | 'vendor' | 'rider'

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted', contacted: 'Contacted', approved: 'Approved', rejected: 'Rejected',
}
const STATUS_COLOR: Record<string, string> = {
  submitted: 'bg-warn-tint text-warn',
  contacted: 'bg-brand-tint text-brand-ink',
  approved: 'bg-brand-tint text-brand-ink',
  rejected: 'bg-red-50 text-danger',
}

export function ApplicationsClient({ initialApps }: Props) {
  const [apps, setApps] = useState(initialApps)
  const [tab, setTab] = useState<TabFilter>('submitted')
  const [kind, setKind] = useState<KindFilter>('all')
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({})
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const visible = apps.filter(a =>
    (tab === 'all' || a.status === tab) &&
    (kind === 'all' || a.kind === kind)
  )

  async function action(id: string, endpoint: string, body?: Record<string, unknown>) {
    setLoading(id)
    const res = await fetch(`/api/admin/applications/${id}/${endpoint}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (res.ok) {
      const j = await res.json()
      setApps(prev => prev.map(a => a.id === id ? { ...a, ...j.updated } : a))
    }
    setRejectingId(null)
    setLoading(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-xl">Applications</h2>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['submitted', 'contacted', 'approved', 'rejected', 'all'] as TabFilter[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-[13px] font-semibold ${
              tab === t ? 'bg-ink text-white' : 'bg-white text-ink-2'
            }`}
          >
            {t === 'all' ? 'All' : STATUS_LABEL[t]}
            <span className="ml-1 opacity-60">{apps.filter(a => t === 'all' ? true : a.status === t).length}</span>
          </button>
        ))}
        <div className="h-6 w-px bg-line mx-1" />
        {(['all', 'vendor', 'rider'] as KindFilter[]).map(k => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`px-3 py-1.5 rounded-full text-[13px] font-semibold capitalize ${
              kind === k ? 'bg-ink text-white' : 'bg-white text-ink-2'
            }`}
          >
            {k === 'all' ? 'All types' : k}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center text-ink-2">Nothing here.</div>
      )}

      {visible.map(app => {
        const isOpen = expanded === app.id
        const data = app.data as Record<string, unknown>

        return (
          <div key={app.id} className="bg-white rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="font-bold text-[15px]">{app.applicant_name}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md capitalize ${STATUS_COLOR[app.status] ?? ''}`}>
                    {app.kind}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${STATUS_COLOR[app.status] ?? ''}`}>
                    {STATUS_LABEL[app.status]}
                  </span>
                </div>
                {app.applicant_phone && (
                  <a href={`tel:${app.applicant_phone}`} className="text-[13px] text-brand">
                    {app.applicant_phone}
                  </a>
                )}
                <p className="text-[12px] text-ink-2 mt-0.5">
                  {new Date(app.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : app.id)}
                className="h-8 px-3 rounded-lg bg-surface text-[12px] font-semibold shrink-0"
              >
                {isOpen ? 'Hide' : 'Details'}
              </button>
            </div>

            {isOpen && (
              <div className="bg-surface rounded-xl p-3 text-[13px] flex flex-col gap-1">
                {Object.entries(data).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-ink-2 font-semibold capitalize">{k.replace(/_/g, ' ')}:</span>
                    <span className="text-ink">{String(v)}</span>
                  </div>
                ))}
                {app.admin_note && (
                  <div className="mt-1 pt-1 border-t border-line">
                    <span className="text-ink-2 font-semibold">Note: </span>
                    <span className="text-ink">{app.admin_note}</span>
                  </div>
                )}
              </div>
            )}

            {/* Reject note textarea */}
            {rejectingId === app.id && (
              <textarea
                value={rejectNotes[app.id] ?? ''}
                onChange={e => setRejectNotes(prev => ({ ...prev, [app.id]: e.target.value }))}
                placeholder="Reason for rejection (shown to applicant)"
                rows={2}
                className="px-3 py-2 rounded-xl border border-line text-[13px] font-body resize-none"
              />
            )}

            {/* Actions */}
            {(app.status === 'submitted' || app.status === 'contacted') && (
              <div className="flex gap-2">
                {rejectingId === app.id ? (
                  <>
                    <button type="button" onClick={() => setRejectingId(null)}
                      className="flex-1 h-9 rounded-xl border border-line bg-white text-sm font-bold text-ink">
                      Cancel
                    </button>
                    <button type="button" disabled={loading === app.id}
                      onClick={() => action(app.id, 'reject', { note: rejectNotes[app.id] ?? '' })}
                      className="flex-1 h-9 rounded-xl bg-danger text-white text-sm font-bold border-0 disabled:opacity-50">
                      {loading === app.id ? 'Rejecting…' : 'Confirm reject'}
                    </button>
                  </>
                ) : (
                  <>
                    {app.status === 'submitted' && (
                      <button type="button" disabled={loading === app.id}
                        onClick={() => action(app.id, 'contact')}
                        className="flex-1 h-9 rounded-xl border border-line bg-white text-[13px] font-bold text-ink-2 disabled:opacity-50">
                        {loading === app.id ? '…' : 'Mark contacted'}
                      </button>
                    )}
                    <button type="button" disabled={loading === app.id}
                      onClick={() => setRejectingId(app.id)}
                      className="flex-1 h-9 rounded-xl border border-line bg-white text-[13px] font-bold text-danger">
                      Reject
                    </button>
                    <button type="button" disabled={loading === app.id}
                      onClick={() => action(app.id, 'approve')}
                      className="flex-1 h-9 rounded-xl bg-brand text-white text-[13px] font-bold border-0 disabled:opacity-50">
                      {loading === app.id ? 'Approving…' : 'Approve'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
