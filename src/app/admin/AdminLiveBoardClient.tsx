'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/format'
import type { Order, OrderStatus } from '@/types/database'

type LiveOrder = Order & {
  vendors: { name: string } | null
  customer: { phone: string } | null
  rider: { full_name: string | null } | null
}

interface Rider {
  id: string
  full_name: string | null
  phone: string
}

const STATUS_COLORS: Partial<Record<OrderStatus, string>> = {
  pending_payment: 'bg-surface text-ink-2',
  paid: 'bg-warn-tint text-warn',
  accepted: 'bg-brand-tint text-brand-ink',
  ready: 'bg-blue-50 text-blue-700',
  picked_up: 'bg-purple-50 text-purple-700',
}

interface Props {
  initialOrders: LiveOrder[]
  riders: Rider[]
}

export function AdminLiveBoardClient({ initialOrders, riders }: Props) {
  const [orders, setOrders] = useState<LiveOrder[]>(initialOrders)
  const [assigningRider, setAssigningRider] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('admin:orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        payload => {
          if (payload.eventType === 'INSERT') {
            setOrders(prev => [...prev, payload.new as LiveOrder])
          } else if (payload.eventType === 'UPDATE') {
            const u = payload.new as LiveOrder
            if (['delivered', 'cancelled', 'expired'].includes(u.status)) {
              setOrders(prev => prev.filter(o => o.id !== u.id))
            } else {
              setOrders(prev => prev.map(o => o.id === u.id ? { ...o, ...u } : o))
            }
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  function elapsed(createdAt: string) {
    const s = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
    const m = Math.floor(s / 60)
    return `${m}m ${s % 60}s`
  }

  async function assignRider(orderId: string, riderId: string) {
    await supabase.from('orders').update({ rider_id: riderId }).eq('id', orderId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, rider_id: riderId } : o))
    setAssigningRider(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-heading font-bold text-xl">Live orders ({orders.length})</h2>

      {orders.length === 0 && (
        <p className="text-ink-2 py-8 text-center">No active orders right now</p>
      )}

      {orders.map(order => {
        const statusColor = STATUS_COLORS[order.status] ?? 'bg-surface text-ink-2'
        const isStuck = (order.status === 'paid' && (Date.now() - new Date(order.paid_at!).getTime()) > 5 * 60 * 1000)

        return (
          <div
            key={order.id}
            className={`bg-white rounded-2xl p-4 flex flex-col gap-3 ${isStuck ? 'border-2 border-danger' : ''}`}
          >
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-base">{order.code}</span>
                <span className="text-sm text-ink-2">{(order.vendors as { name: string } | null)?.name}</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColor}`}>
                  {order.status.replace('_', ' ').toUpperCase()}
                </span>
                <span className="text-xs text-ink-2">{elapsed(order.created_at)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold">{formatMoney(order.total)}</span>
              <span className="text-sm text-ink-2">{order.address_zone} · {order.address_landmark}</span>
            </div>

            {/* Rider assignment */}
            {['accepted', 'ready', 'picked_up'].includes(order.status) && (
              <div className="flex items-center gap-2">
                {order.rider_id ? (
                  <span className="text-sm text-ink-2">
                    Rider: {riders.find(r => r.id === order.rider_id)?.full_name ?? 'Assigned'}
                  </span>
                ) : (
                  <span className="text-sm text-warn font-semibold">No rider assigned</span>
                )}
                {assigningRider === order.id ? (
                  <select
                    className="flex-1 h-9 px-2 rounded-xl border border-line text-sm"
                    defaultValue=""
                    onChange={e => e.target.value && assignRider(order.id, e.target.value)}
                  >
                    <option value="" disabled>Select rider…</option>
                    {riders.map(r => (
                      <option key={r.id} value={r.id}>{r.full_name ?? r.phone}</option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAssigningRider(order.id)}
                    className="h-9 px-3 rounded-xl bg-brand-tint text-brand-ink text-xs font-bold"
                  >
                    {order.rider_id ? 'Reassign' : 'Assign rider'}
                  </button>
                )}
              </div>
            )}

            {/* Admin actions */}
            <div className="flex gap-2">
              {order.status === 'paid' && (
                <button
                  type="button"
                  onClick={() => fetch(`/api/orders/${order.id}/transition`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ toStatus: 'cancelled', note: 'Admin cancelled' }),
                  })}
                  className="h-9 px-3 rounded-xl border border-line text-xs font-bold text-danger"
                >
                  Cancel &amp; refund
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
