'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function RefundsPage() {
  const router = useRouter()
  return (
    <div className="min-h-dvh bg-canvas font-body text-ink"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>

      <header className="bg-white px-4 pt-5 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-surface flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-heading font-extrabold text-[20px] text-ink">Refund policy</h1>
      </header>

      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl p-5 flex flex-col gap-4">
          <div>
            <h2 className="font-heading font-bold text-[15px] text-ink mb-2">When we refund</h2>
            <p className="text-[14px] text-ink-2 leading-relaxed">
              You are entitled to a full refund if your order is cancelled before a rider picks it
              up, if an item is missing or incorrect, or if delivery could not be completed through
              no fault of your own.
            </p>
          </div>
          <div>
            <h2 className="font-heading font-bold text-[15px] text-ink mb-2">How to request</h2>
            <p className="text-[14px] text-ink-2 leading-relaxed">
              Raise a support ticket in Help &amp; Support within 24 hours of the order. Include
              your order number and a brief description of the issue.
            </p>
          </div>
          <div>
            <h2 className="font-heading font-bold text-[15px] text-ink mb-2">Processing time</h2>
            <p className="text-[14px] text-ink-2 leading-relaxed">
              Approved refunds are returned to your original payment method within 3–5 business
              days depending on your bank.
            </p>
          </div>
          <p className="text-[12px] text-ink-2 pt-2 border-t border-line">
            Full refund policy will be published before our public launch. Last updated: November 2024.
          </p>
        </div>
      </div>
    </div>
  )
}
