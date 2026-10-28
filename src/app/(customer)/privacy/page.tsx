'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
  const router = useRouter()
  return (
    <div className="min-h-dvh bg-canvas font-body text-ink"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>

      <header className="bg-white px-4 pt-5 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-surface flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-heading font-extrabold text-[20px] text-ink">Privacy policy</h1>
      </header>

      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl p-5 flex flex-col gap-4">
          <div>
            <h2 className="font-heading font-bold text-[15px] text-ink mb-2">What we collect</h2>
            <p className="text-[14px] text-ink-2 leading-relaxed">
              We collect your name, phone number, email address and delivery addresses to fulfil
              your orders. We also collect order history to improve our service and handle support
              requests.
            </p>
          </div>
          <div>
            <h2 className="font-heading font-bold text-[15px] text-ink mb-2">How we use it</h2>
            <p className="text-[14px] text-ink-2 leading-relaxed">
              Your data is used to process and deliver your orders, communicate order status, and
              improve the Dart experience. We do not sell your data to third parties.
            </p>
          </div>
          <div>
            <h2 className="font-heading font-bold text-[15px] text-ink mb-2">Your rights</h2>
            <p className="text-[14px] text-ink-2 leading-relaxed">
              You can update your profile, manage notification preferences and request account
              deletion from the Account page at any time. For any other data requests, contact
              us at hello@dart.ng.
            </p>
          </div>
          <p className="text-[12px] text-ink-2 pt-2 border-t border-line">
            Full privacy policy will be published before our public launch. Last updated: November 2024.
          </p>
        </div>
      </div>
    </div>
  )
}
