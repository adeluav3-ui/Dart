'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/format'
import type { Order, OrderItem } from '@/types/database'

type DispatchOrder = Order & {
  vendors: { name: string } | null
  order_items: { name_snapshot: string; qty: number }[]
}

interface RiderWithLoad {
  id: string
  full_name: string | null
  phone: string
  activeJobs: number
}

interface Props {
  initialOrders: DispatchOrder[]
  riders: RiderWithLoad[]
}

export function DispatchClient({ initialOrders, riders }: Props) {
  const [orders, setOrders] = useState(initialOrders)
  const [assigning, setAssigning] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const supabase = createClient()

  async function assign(orderId: string) {
    const riderId = assigning[orderId]
    if (!riderId) return
    setSaving(orderId)
    await supabase.from('orders').update({ rider_id: riderId }).eq('id', orderId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, rider_id: riderId } : o))
    setSaving(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-heading font-bold text-xl">Dispatch</h2>
      <div className="flex gap-4">
        {/* Rider panel */}
        <div className="w-48 flex-none flex flex-col gap-2">
          <h3 className="text-xs font-bold text-ink-2 uppercase tracking-wide">Riders</h3>
          {riders.map(r => (
            <div key={r.id} className="bg-white rounded-xl p-3 flex flex-col gap-0.5">
              <span className="text-sm font-bold">{r.full_name ?? r.phone}</span>
              <span className="text-xs text-ink-2">{r.activeJobs} active job{r.activeJobs !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>

        {/* Orders */}
        <div className="flex-1 flex flex-col gap-3">
          {orders.length === 0 && <p className="text-ink-2 text-sm py-8">No orders need dispatch</p>}
          {orders.map(order => (
            <div key={order.id} className="bg-white rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="font-bold">{order.code} — {(order.vendors as { name: string } | null)?.name}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-warn-tint text-warn">{order.status}</span>
              </div>
              <span className="text-sm text-ink-2">{order.address_zone} · {order.address_landmark}</span>
              <span className="text-sm font-bold">{formatMoney(order.total)}</span>
              <div className="flex gap-2 items-center mt-1">
                <select
                  value={assigning[order.id] ?? order.rider_id ?? ''}
                  onChange={e => setAssigning(p => ({ ...p, [order.id]: e.target.value }))}
                  className="flex-1 h-9 px-2 rounded-xl border border-line text-sm font-body"
                >
                  <option value="">— Assign rider —</option>
                  {riders.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.full_name ?? r.phone} ({r.activeJobs} jobs)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!assigning[order.id] || saving === order.id}
                  onClick={() => assign(order.id)}
                  className="h-9 px-4 rounded-xl bg-brand text-white text-sm font-bold disabled:opacity-50"
                >
                  {saving === order.id ? '…' : order.rider_id ? 'Reassign' : 'Assign'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
