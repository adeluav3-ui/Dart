'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  userId: string
  marketingEmails: boolean
}

export function NotificationsClient({ userId, marketingEmails: initial }: Props) {
  const router = useRouter()
  const [marketing, setMarketing] = useState(initial)
  const supabase = createClient()

  async function toggle() {
    const next = !marketing
    setMarketing(next)
    await supabase.from('profiles').update({ marketing_emails: next }).eq('id', userId)
  }

  return (
    <div className="min-h-dvh bg-canvas font-body text-ink"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>

      <header className="bg-white px-4 pt-5 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-surface flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-heading font-extrabold text-[20px] text-ink">Email updates</h1>
      </header>

      <div className="px-4 pt-4 flex flex-col gap-3">
        <div className="bg-white rounded-2xl overflow-hidden">
          {/* Order updates — always on */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-line">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-ink">Order updates</p>
              <p className="text-[12px] text-ink-2 mt-0.5">Receipts, delivery status and confirmations</p>
            </div>
            <div className="w-12 h-6 rounded-full bg-brand flex items-center justify-end pr-1 opacity-40 cursor-not-allowed shrink-0">
              <div className="w-4 h-4 rounded-full bg-white shadow" />
            </div>
          </div>

          {/* Promotions toggle */}
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-ink">Promotions &amp; offers</p>
              <p className="text-[12px] text-ink-2 mt-0.5">Deals, new vendors and GoCart news</p>
            </div>
            <button
              type="button"
              onClick={toggle}
              aria-checked={marketing}
              role="switch"
              className={`w-12 h-6 rounded-full flex items-center shrink-0 transition-colors duration-200 ${
                marketing ? 'bg-brand justify-end pr-1' : 'bg-surface justify-start pl-1'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow" />
            </button>
          </div>
        </div>

        <p className="text-[12px] text-ink-2 px-1">
          We&apos;ll always send you order updates regardless of this setting.
        </p>
      </div>
    </div>
  )
}
