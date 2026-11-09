'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function NewVendorPage() {
  const [form, setForm] = useState({
    name: '',
    type: 'restaurant',
    category: '',
    description: '',
    commission_rate: '10',
    payout_bank: '',
    payout_account_no: '',
    payout_account_name: '',
    ownerEmail: '',
    zone_id: '',
  })
  const [zones, setZones] = useState<{ id: string; name: string }[]>([])
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('zones').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => { if (data) setZones(data) })
  }, [])

  function slug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setLoading(true)
    setError('')

    let coverUrl = null

    // Upload cover photo if provided
    if (coverFile) {
      const ext = coverFile.name.split('.').pop()
      const path = `${Date.now()}-${slug(form.name)}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('vendor-photos')
        .upload(path, coverFile, { contentType: coverFile.type })
      if (!uploadErr) {
        const { data } = supabase.storage.from('vendor-photos').getPublicUrl(path)
        coverUrl = data.publicUrl
      }
    }

    // Find or create owner profile if email given
    let ownerId = null
    if (form.ownerEmail.trim()) {
      const res = await fetch('/api/admin/users/find-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.ownerEmail.trim().toLowerCase(), role: 'vendor' }),
      })
      const json = await res.json()
      ownerId = json.userId
    }

    const { error: insertErr } = await supabase.from('vendors').insert({
      name: form.name.trim(),
      slug: slug(form.name) + '-' + Date.now().toString(36),
      type: form.type,
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      commission_rate: parseFloat(form.commission_rate) / 100,
      cover_photo_url: coverUrl,
      payout_bank: form.payout_bank.trim() || null,
      payout_account_no: form.payout_account_no.trim() || null,
      payout_account_name: form.payout_account_name.trim() || null,
      owner_id: ownerId,
      zone_id: form.zone_id || null,
    })

    setLoading(false)
    if (insertErr) {
      setError(insertErr.message)
    } else {
      router.push('/admin/vendors')
    }
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/vendors" className="text-brand text-sm font-semibold">â† Back</Link>
        <h2 className="font-heading font-bold text-xl">New vendor</h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 flex flex-col gap-4">
        <Input
          label="Vendor name"
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          required
        />

        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
          Type
          <select
            value={form.type}
            onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
            className="h-btn-sm px-3 rounded-xl border border-line font-body text-[15px]"
          >
            <option value="restaurant">Restaurant</option>
            <option value="supermarket">Supermarket</option>
            <option value="pharmacy">Pharmacy</option>
          </select>
        </label>

        <Input
          label="Category / cuisine (e.g. Amala, rice, swallow)"
          value={form.category}
          onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
        />

        <Input
          label="Description (optional)"
          value={form.description}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
        />

        <Input
          label="Commission % (e.g. 10 for 10%)"
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={form.commission_rate}
          onChange={e => setForm(p => ({ ...p, commission_rate: e.target.value }))}
        />

        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
          Cover photo (WebP preferred, ~100 KB)
          <input
            type="file"
            accept="image/*"
            onChange={e => setCoverFile(e.target.files?.[0] ?? null)}
            className="text-sm font-body text-ink-2"
          />
        </label>

        <div className="border-t border-line pt-4 flex flex-col gap-3">
          <span className="text-xs font-bold text-ink-2 uppercase tracking-wide">Payout details</span>
          <Input
            label="Bank name"
            value={form.payout_bank}
            onChange={e => setForm(p => ({ ...p, payout_bank: e.target.value }))}
          />
          <Input
            label="Account number"
            value={form.payout_account_no}
            onChange={e => setForm(p => ({ ...p, payout_account_no: e.target.value }))}
          />
          <Input
            label="Account name"
            value={form.payout_account_name}
            onChange={e => setForm(p => ({ ...p, payout_account_name: e.target.value }))}
          />
        </div>

        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
          Vendor zone (where this vendor is located)
          <select
            value={form.zone_id}
            onChange={e => setForm(p => ({ ...p, zone_id: e.target.value }))}
            className="h-btn-sm px-3 rounded-xl border border-line font-body text-[15px]"
          >
            <option value="">â€” Select zone â€”</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </label>

        <div className="border-t border-line pt-4 flex flex-col gap-3">
          <span className="text-xs font-bold text-ink-2 uppercase tracking-wide">Owner login</span>
          <Input
            label="Owner email (they log in with a code sent to this email)"
            type="email"
            placeholder="owner@restaurant.com"
            value={form.ownerEmail}
            onChange={e => setForm(p => ({ ...p, ownerEmail: e.target.value }))}
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" loading={loading} fullWidth size="lg">Create vendor</Button>
      </form>
    </div>
  )
}
