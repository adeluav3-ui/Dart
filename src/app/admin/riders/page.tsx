'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface RiderRow {
  id: string
  full_name: string | null
  phone: string | null
  email: string | null
  is_active: boolean
}

export default function AdminRidersPage() {
  const [riders, setRiders] = useState<RiderRow[]>([])
  const [form, setForm] = useState({ full_name: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('riders')
      .select('id, is_active, profiles(full_name, phone)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        type RiderData = {
          id: string
          is_active: boolean
          profiles: { full_name: string | null; phone: string | null }[] | null
        }
        setRiders(
          (data as unknown as RiderData[] ?? []).map(r => {
            const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
            return {
              id: r.id,
              full_name: p?.full_name ?? null,
              phone: p?.phone ?? null,
              email: null,
              is_active: r.is_active,
            }
          })
        )
      })
  }, [])

  async function addRider() {
    if (!form.full_name.trim() || !form.email.trim().includes('@')) {
      setError('Name and valid email required'); return
    }
    setSaving(true)
    setError('')

    const res = await fetch('/api/admin/users/find-or-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email.trim().toLowerCase(), role: 'rider' }),
    })
    const { userId, error: err } = await res.json()
    if (err || !userId) { setError(err ?? 'Failed'); setSaving(false); return }

    // Update profile name and phone
    await supabase.from('profiles').update({
      full_name: form.full_name.trim(),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
    }).eq('id', userId)

    // Create riders row (upsert in case it already exists)
    await supabase.from('riders').upsert({ id: userId, is_active: true })

    setRiders(p => [{
      id: userId,
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim(),
      is_active: true,
    }, ...p])
    setForm({ full_name: '', email: '', phone: '' })
    setSaving(false)
  }

  async function toggleActive(rider: RiderRow) {
    await supabase.from('riders').update({ is_active: !rider.is_active }).eq('id', rider.id)
    setRiders(prev => prev.map(r => r.id === rider.id ? { ...r, is_active: !r.is_active } : r))
  }

  async function deleteRider(rider: RiderRow) {
    const confirmed = window.confirm(
      `Remove ${rider.full_name ?? 'this rider'} permanently?\n\n` +
      `• They lose rider dashboard access immediately\n` +
      `• Their account reverts to a customer account\n` +
      `• Past delivery history is preserved\n\n` +
      `This cannot be undone.`
    )
    if (!confirmed) return
    await fetch(`/api/admin/riders/${rider.id}`, { method: 'DELETE' })
    setRiders(prev => prev.filter(r => r.id !== rider.id))
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-4">
      <h2 className="font-heading font-bold text-xl">Riders</h2>

      <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
        <h3 className="font-bold text-sm">Add rider</h3>
        <Input label="Full name" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
        <Input label="Email address" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
        <Input label="Phone (optional, for vendor call button)" type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button onClick={addRider} loading={saving} size="lg">Add rider</Button>
      </div>

      {riders.map(rider => (
        <div key={rider.id} className="bg-white rounded-2xl p-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-surface flex items-center justify-center font-bold text-sm">
            {rider.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '??'}
          </span>
          <div className="flex-1">
            <p className="font-bold text-sm">{rider.full_name ?? 'No name'}</p>
            {rider.phone && <p className="text-xs text-ink-2">{rider.phone}</p>}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={rider.is_active}
            onClick={() => toggleActive(rider)}
            className={`relative w-11 h-6 rounded-full border-0 cursor-pointer transition-colors ${rider.is_active ? 'bg-brand' : 'bg-[#C3C8CD]'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${rider.is_active ? 'left-5' : 'left-0.5'}`} />
          </button>
          <button
            type="button"
            onClick={() => deleteRider(rider)}
            className="h-8 px-3 rounded-xl bg-white border border-danger/30 text-danger text-[12px] font-bold"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  )
}
