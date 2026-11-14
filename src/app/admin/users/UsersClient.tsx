'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { UserRole, Zone } from '@/types/database'

interface UserRow {
  id: string
  full_name: string | null
  email: string
  phone: string | null
  role: UserRole
  created_at: string
}

interface Props {
  users: UserRow[]
  zones: Zone[]
}

const ROLE_STYLES: Record<UserRole, string> = {
  customer: 'bg-surface text-ink-2',
  vendor:   'bg-brand-tint text-brand-ink',
  rider:    'bg-[#EDE6DA] text-[#7A5C1E]',
  admin:    'bg-[#F3E8FF] text-[#6B21A8]',
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function UsersClient({ users, zones }: Props) {
  const [search, setSearch] = useState('')
  const [vendorSheetUser, setVendorSheetUser] = useState<UserRow | null>(null)
  const [confirmRider, setConfirmRider] = useState<UserRow | null>(null)
  const [confirmDemote, setConfirmDemote] = useState<UserRow | null>(null)
  const [confirmBan, setConfirmBan] = useState<UserRow | null>(null)
  const router = useRouter()

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    return (
      !q ||
      u.full_name?.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.phone?.includes(q)
    )
  })

  async function makeRider(userId: string) {
    const res = await fetch('/api/admin/promote-rider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? 'Failed')
      return
    }
    setConfirmRider(null)
    router.refresh()
  }

  async function banCustomer(userId: string) {
    const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? 'Failed')
      return
    }
    setConfirmBan(null)
    router.refresh()
  }

  async function demote(userId: string) {
    const res = await fetch('/api/admin/demote-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? 'Failed')
      return
    }
    setConfirmDemote(null)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-xl">Users ({users.length})</h2>
      </div>

      <input
        type="search"
        placeholder="Search by name, email or phone…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="h-10 px-4 rounded-xl border border-line font-body text-sm text-ink bg-white w-full max-w-sm"
      />

      <div className="flex flex-col gap-2">
        {filtered.map(user => (
          <div key={user.id} className="bg-white rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-bold text-[15px] text-ink truncate">
                  {user.full_name || '(no name)'}
                </span>
                <span className="text-[13px] text-ink-2 truncate">{user.email}</span>
                {user.phone && (
                  <span className="text-[13px] text-ink-2">{user.phone}</span>
                )}
              </div>
              <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${ROLE_STYLES[user.role]}`}>
                {user.role}
              </span>
            </div>

            {user.role !== 'admin' && (
              <div className="flex gap-2 flex-wrap pt-1">
                {user.role === 'customer' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setVendorSheetUser(user)}
                      className="h-8 px-3 rounded-xl bg-brand-tint text-brand-ink text-[13px] font-bold"
                    >
                      Make vendor
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRider(user)}
                      className="h-8 px-3 rounded-xl bg-[#EDE6DA] text-[#7A5C1E] text-[13px] font-bold"
                    >
                      Make rider
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmBan(user)}
                      className="h-8 px-3 rounded-xl bg-white border border-danger/30 text-danger text-[13px] font-bold"
                    >
                      Ban account
                    </button>
                  </>
                )}
                {(user.role === 'vendor' || user.role === 'rider') && (
                  <button
                    type="button"
                    onClick={() => setConfirmDemote(user)}
                    className="h-8 px-3 rounded-xl bg-surface text-ink-2 text-[13px] font-bold"
                  >
                    Demote to customer
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="text-sm text-ink-2 text-center py-8">No users found.</p>
        )}
      </div>

      {/* Make Vendor sheet */}
      {vendorSheetUser && (
        <VendorSheet
          user={vendorSheetUser}
          zones={zones}
          onClose={() => setVendorSheetUser(null)}
          onDone={() => { setVendorSheetUser(null); router.refresh() }}
        />
      )}

      {/* Confirm Make Rider */}
      {confirmRider && (
        <ConfirmSheet
          title="Make rider"
          message={`Give ${confirmRider.full_name || confirmRider.email} access to the rider dashboard?`}
          confirmLabel="Yes, make rider"
          onConfirm={() => makeRider(confirmRider.id)}
          onClose={() => setConfirmRider(null)}
        />
      )}

      {/* Confirm Ban */}
      {confirmBan && (
        <ConfirmSheet
          title="Ban account"
          message={`Permanently ban ${confirmBan.full_name || confirmBan.email}?\n\nThey will be signed out immediately and can never log in or register again with this email or phone number. This cannot be undone.`}
          confirmLabel="Yes, ban permanently"
          danger
          onConfirm={() => banCustomer(confirmBan.id)}
          onClose={() => setConfirmBan(null)}
        />
      )}

      {/* Confirm Demote */}
      {confirmDemote && (
        <ConfirmSheet
          title="Demote to customer"
          message={`Remove ${confirmDemote.full_name || confirmDemote.email}'s ${confirmDemote.role} access? Their vendor/rider data won't be deleted.`}
          confirmLabel="Yes, demote"
          onConfirm={() => demote(confirmDemote.id)}
          onClose={() => setConfirmDemote(null)}
        />
      )}
    </div>
  )
}

function VendorSheet({
  user, zones, onClose, onDone,
}: {
  user: UserRow
  zones: Zone[]
  onClose: () => void
  onDone: () => void
}) {
  const [businessName, setBusinessName] = useState(user.full_name ?? '')
  const [slug, setSlug] = useState(slugify(user.full_name ?? ''))
  const [type, setType] = useState('restaurant')
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? '')
  const [commission, setCommission] = useState('5')
  const [prepMins, setPrepMins] = useState('30')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setError('')
    if (!businessName.trim()) { setError('Enter a business name'); return }
    if (!slug.trim()) { setError('Enter a slug'); return }
    if (!zoneId) { setError('Select a zone'); return }

    setSaving(true)
    const res = await fetch('/api/admin/promote-vendor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        businessName: businessName.trim(),
        slug: slug.trim(),
        type,
        zoneId,
        commissionRate: parseFloat(commission) / 100,
        avgPrepMins: parseInt(prepMins) || 30,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? 'Failed')
      return
    }
    onDone()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl max-w-md mx-auto flex flex-col"
        style={{ maxHeight: '90dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
          <span className="font-heading font-bold text-[17px]">Make vendor</span>
          <button type="button" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-surface">
            <X size={16} />
          </button>
        </div>
        <p className="px-5 text-[13px] text-ink-2 -mt-2 pb-3 shrink-0">
          For: <span className="font-semibold text-ink">{user.email}</span>
        </p>

        <div className="overflow-y-auto px-5 pb-6 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-ink-2">Business name</span>
            <input
              type="text"
              value={businessName}
              onChange={e => { setBusinessName(e.target.value); setSlug(slugify(e.target.value)) }}
              className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-ink-2">URL slug (e.g. mama-ngozi-kitchen)</span>
            <input
              type="text"
              value={slug}
              onChange={e => setSlug(slugify(e.target.value))}
              className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-ink-2">Type</span>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink bg-white"
            >
              <option value="restaurant">Restaurant</option>
              <option value="supermarket">Supermarket</option>
              <option value="pharmacy">Pharmacy</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-ink-2">Zone</span>
            <select
              value={zoneId}
              onChange={e => setZoneId(e.target.value)}
              className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink bg-white"
            >
              {zones.map(z => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
          </label>

          <div className="flex gap-3">
            <label className="flex-1 flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-ink-2">Commission %</span>
              <input
                type="number"
                min="0" max="100"
                value={commission}
                onChange={e => setCommission(e.target.value)}
                className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink"
              />
            </label>
            <label className="flex-1 flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-ink-2">Avg prep (mins)</span>
              <input
                type="number"
                min="5"
                value={prepMins}
                onChange={e => setPrepMins(e.target.value)}
                className="h-11 px-3 rounded-xl border border-line font-body text-[15px] text-ink"
              />
            </label>
          </div>

          {error && <p className="text-[13px] text-danger">{error}</p>}

          <Button onClick={submit} loading={saving} fullWidth size="lg">
            Create vendor account
          </Button>
        </div>
      </div>
    </>
  )
}

function ConfirmSheet({
  title, message, confirmLabel, danger, onConfirm, onClose,
}: {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)

  async function handle() {
    setLoading(true)
    await onConfirm()
    setLoading(false)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl max-w-md mx-auto p-5 flex flex-col gap-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
        <div className="flex items-center justify-between">
          <span className="font-heading font-bold text-[17px]">{title}</span>
          <button type="button" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-surface">
            <X size={16} />
          </button>
        </div>
        <p className="text-[14px] text-ink-2 leading-relaxed">{message}</p>
        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-surface text-ink text-[14px] font-bold">
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handle}
            className={`flex-1 h-11 rounded-xl text-[14px] font-bold disabled:opacity-50 ${
              danger ? 'bg-danger text-white' : 'bg-brand text-white'
            }`}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </>
  )
}
