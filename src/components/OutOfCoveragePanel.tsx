'use client'

import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

interface Props {
  lat: number
  lng: number
  initialEmail?: string
  userId?: string | null
  onChangeSpot: () => void
}

export function OutOfCoveragePanel({ lat, lng, initialEmail, userId, onChangeSpot }: Props) {
  const [email, setEmail] = useState(initialEmail ?? '')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createClient()

  async function handleNotify() {
    setSaving(true)
    await supabase.from('coverage_waitlist').insert({
      email: email.trim() || null,
      lat,
      lng,
      user_id: userId ?? null,
    })
    setSaving(false)
    setDone(true)
  }

  return (
    <div className="flex flex-col items-center text-center px-6 py-10 gap-5 max-w-sm mx-auto">
      <div className="w-14 h-14 rounded-full bg-warn-tint flex items-center justify-center">
        <MapPin size={24} stroke="#8A4B08" />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-heading font-extrabold text-[20px] text-ink">
          We don&apos;t deliver here yet
        </h2>
        <p className="text-[14px] text-ink-2 leading-relaxed">
          GoCart is only in parts of Sagamu for now. Leave your email and we&apos;ll tell you when we reach you.
        </p>
      </div>

      {done ? (
        <div className="w-full px-4 py-3 rounded-2xl bg-brand-tint text-brand-ink text-[14px] font-medium">
          Thanks, we&apos;ll email you when we expand there.
        </div>
      ) : (
        <div className="w-full flex flex-col gap-3">
          <input
            type="email"
            placeholder="Your email (optional)"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="h-btn-sm px-4 rounded-xl border border-line font-body text-[14px] text-ink bg-white w-full"
          />
          <Button onClick={handleNotify} loading={saving} fullWidth size="lg">
            Notify me
          </Button>
        </div>
      )}

      <button
        type="button"
        onClick={onChangeSpot}
        className="text-[14px] font-semibold text-brand bg-transparent border-0 cursor-pointer"
      >
        Choose another spot
      </button>
    </div>
  )
}
