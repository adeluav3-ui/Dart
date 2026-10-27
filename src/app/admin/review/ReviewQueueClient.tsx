'use client'

import { useState } from 'react'
import Image from 'next/image'
import { formatMoney } from '@/lib/format'
import type { MenuItem, MenuItemStatus } from '@/types/database'

interface ReviewItem extends MenuItem {
  vendor_name: string
  category_name: string | null
}

interface Props {
  initialItems: ReviewItem[]
}

const STATUS_LABEL: Record<MenuItemStatus, string> = {
  draft: 'Draft', in_review: 'In review', live: 'Live', rejected: 'Rejected',
}
const STATUS_COLOR: Record<MenuItemStatus, string> = {
  draft: 'bg-surface text-ink-2', in_review: 'bg-warn-tint text-warn',
  live: 'bg-brand-tint text-brand-ink', rejected: 'bg-red-50 text-danger',
}

export function ReviewQueueClient({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems)
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({})
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  async function approve(itemId: string) {
    setLoading(itemId)
    const res = await fetch(`/api/admin/items/${itemId}/approve`, { method: 'POST' })
    if (res.ok) {
      setItems(prev => prev.map(i => i.id === itemId
        ? {
            ...i,
            status: 'live' as MenuItemStatus,
            base_price: i.pending_price ?? i.base_price,
            photo_url: i.pending_photo_url ?? i.photo_url,
            pending_price: null,
            pending_photo_url: null,
          }
        : i
      ))
    }
    setLoading(null)
  }

  async function reject(itemId: string) {
    setLoading(itemId)
    const note = rejectNote[itemId] ?? ''
    const res = await fetch(`/api/admin/items/${itemId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    })
    if (res.ok) {
      setItems(prev => prev.map(i => i.id === itemId
        ? { ...i, status: 'rejected' as MenuItemStatus, review_note: note || null }
        : i
      ))
      setRejectingId(null)
    }
    setLoading(null)
  }

  const pendingItems = items.filter(i => i.status === 'in_review' || i.pending_price != null || i.pending_photo_url != null)

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-heading font-bold text-xl">Review queue</h2>

      {pendingItems.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center text-ink-2">
          Nothing to review right now.
        </div>
      )}

      {pendingItems.map(item => {
        const hasPendingChanges = item.status === 'live' && (item.pending_price != null || item.pending_photo_url != null)
        const isNew = item.status === 'in_review'

        return (
          <div key={item.id} className="bg-white rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              {/* Photo */}
              <div className="w-16 h-16 rounded-xl bg-photo shrink-0 overflow-hidden flex items-center justify-center">
                {(item.pending_photo_url ?? item.photo_url) ? (
                  <Image
                    src={item.pending_photo_url ?? item.photo_url!}
                    alt={item.name}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B8A98C" strokeWidth="1.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-bold text-base">{item.name}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${STATUS_COLOR[item.status]}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>
                <p className="text-xs text-ink-2">{item.vendor_name}</p>
                {item.category_name && (
                  <p className="text-xs text-ink-2">{item.category_name}</p>
                )}
                {item.description && (
                  <p className="text-xs text-ink-2 mt-0.5">{item.description}</p>
                )}
              </div>
            </div>

            {/* Price comparison */}
            <div className="flex gap-4">
              {isNew && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-ink-2">Price</span>
                  <span className="text-sm font-bold">
                    {item.base_price > 0 ? formatMoney(item.base_price) : 'Not set'}
                  </span>
                </div>
              )}
              {hasPendingChanges && item.pending_price != null && (
                <div className="flex gap-3 items-center">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-ink-2">Current price</span>
                    <span className="text-sm font-bold">{formatMoney(item.base_price)}</span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-ink-2">Proposed</span>
                    <span className="text-sm font-bold text-brand">{formatMoney(item.pending_price)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Photo change preview */}
            {hasPendingChanges && item.pending_photo_url && item.pending_photo_url !== item.photo_url && (
              <div className="flex gap-3 items-center">
                {item.photo_url && (
                  <div className="flex flex-col gap-1 items-center">
                    <span className="text-[10px] text-ink-2">Current</span>
                    <div className="w-16 h-16 rounded-xl overflow-hidden">
                      <Image src={item.photo_url} alt="current" width={64} height={64} className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <div className="flex flex-col gap-1 items-center">
                  <span className="text-[10px] text-ink-2">New</span>
                  <div className="w-16 h-16 rounded-xl overflow-hidden">
                    <Image src={item.pending_photo_url} alt="new" width={64} height={64} className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
            )}

            {/* Reject form */}
            {rejectingId === item.id && (
              <div className="flex flex-col gap-2">
                <textarea
                  value={rejectNote[item.id] ?? ''}
                  onChange={e => setRejectNote(prev => ({ ...prev, [item.id]: e.target.value }))}
                  placeholder="Reason for rejection (shown to vendor)"
                  rows={2}
                  className="px-3 py-2 rounded-xl border border-line text-sm font-body resize-none"
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              {rejectingId === item.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => setRejectingId(null)}
                    className="flex-1 h-9 rounded-xl border border-line bg-white text-sm font-bold text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={loading === item.id}
                    onClick={() => reject(item.id)}
                    className="flex-1 h-9 rounded-xl bg-danger text-white text-sm font-bold border-0 disabled:opacity-50"
                  >
                    {loading === item.id ? 'Rejecting…' : 'Confirm reject'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={loading === item.id}
                    onClick={() => setRejectingId(item.id)}
                    className="flex-1 h-9 rounded-xl border border-line bg-white text-sm font-bold text-danger"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={loading === item.id}
                    onClick={() => approve(item.id)}
                    className="flex-1 h-9 rounded-xl bg-brand text-white text-sm font-bold border-0 disabled:opacity-50"
                  >
                    {loading === item.id ? 'Approving…' : 'Approve'}
                  </button>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
