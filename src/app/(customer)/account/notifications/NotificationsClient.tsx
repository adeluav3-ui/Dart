'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Smartphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  enablePush,
  disablePush,
  isPushSubscribed,
  isPushSupported,
  isIOS,
  isIOSPushSupported,
} from '@/lib/notifications/push'

interface Props {
  userId: string
  marketingEmails: boolean
}

export function NotificationsClient({ userId, marketingEmails: initial }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // ── Email ────────────────────────────────────────────────────
  const [marketing, setMarketing] = useState(initial)

  async function toggleMarketing() {
    const next = !marketing
    setMarketing(next)
    await supabase.from('profiles').update({ marketing_emails: next }).eq('id', userId)
  }

  // ── Push ─────────────────────────────────────────────────────
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [iosNoInstall, setIosNoInstall] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    const supported = isPushSupported()
    const iosDevice = isIOS()
    const iosPwa = isIOSPushSupported()

    if (iosDevice && !iosPwa) {
      setIosNoInstall(true)
      return
    }
    setPushSupported(supported)
    if (supported) {
      isPushSubscribed().then(setPushEnabled)
    }
  }, [])

  async function togglePush() {
    setPushLoading(true)
    setPermissionDenied(false)
    if (pushEnabled) {
      await disablePush()
      setPushEnabled(false)
    } else {
      const ok = await enablePush()
      if (!ok) setPermissionDenied(true)
      setPushEnabled(ok)
    }
    setPushLoading(false)
  }

  return (
    <div className="min-h-dvh bg-canvas font-body text-ink"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>

      <header className="bg-white px-4 pt-5 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-surface flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-heading font-extrabold text-[20px] text-ink">Notifications</h1>
      </header>

      <div className="px-4 pt-4 flex flex-col gap-3">

        {/* ── Push section ── */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <p className="text-[12px] font-bold text-ink-2 uppercase tracking-widest">Push notifications</p>
          </div>

          {/* iOS — not installed as PWA */}
          {iosNoInstall && (
            <div className="flex items-start gap-3 px-4 py-4">
              <Smartphone size={20} className="text-ink-2 shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-semibold text-ink">Add GoCart to your Home Screen</p>
                <p className="text-[12px] text-ink-2 mt-1 leading-relaxed">
                  On iPhone, push notifications require the app to be installed.
                  Tap the Share button in Safari, then &ldquo;Add to Home Screen&rdquo;.
                </p>
              </div>
            </div>
          )}

          {/* Normal push toggle */}
          {!iosNoInstall && (
            <div className="flex items-center gap-3 px-4 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-ink">Order updates</p>
                <p className="text-[12px] text-ink-2 mt-0.5">
                  {pushSupported
                    ? 'Rider assigned, on the way, delivered'
                    : 'Not supported in this browser'}
                </p>
                {permissionDenied && (
                  <p className="text-[11px] text-danger mt-1">
                    Permission blocked. Enable notifications in your browser settings.
                  </p>
                )}
              </div>
              {pushSupported ? (
                <button
                  type="button"
                  onClick={togglePush}
                  aria-checked={pushEnabled}
                  role="switch"
                  disabled={pushLoading}
                  className={`w-12 h-6 rounded-full flex items-center shrink-0 transition-colors duration-200 ${
                    pushEnabled ? 'bg-brand justify-end pr-1' : 'bg-surface justify-start pl-1'
                  } ${pushLoading ? 'opacity-50 cursor-wait' : ''}`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow transition-all" />
                </button>
              ) : (
                <div className="w-12 h-6 rounded-full bg-surface flex items-center justify-start pl-1 opacity-40 cursor-not-allowed shrink-0">
                  <div className="w-4 h-4 rounded-full bg-white shadow" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Email section ── */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <p className="text-[12px] font-bold text-ink-2 uppercase tracking-widest">Email</p>
          </div>

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
              onClick={toggleMarketing}
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
          Order update emails are always sent regardless of these settings.
        </p>
      </div>
    </div>
  )
}
