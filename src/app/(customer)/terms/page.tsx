'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function TermsPage() {
  const router = useRouter()
  return (
    <div className="min-h-dvh bg-canvas font-body text-ink"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>

      <header className="bg-white px-4 pt-5 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-surface flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-heading font-extrabold text-[20px] text-ink">Terms of use</h1>
      </header>

      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl p-5 flex flex-col gap-4">
          <div>
            <h2 className="font-heading font-bold text-[15px] text-ink mb-2">About Dart</h2>
            <p className="text-[14px] text-ink-2 leading-relaxed">
              Dart is a local delivery service operating in Sagamu, Ogun State, Nigeria. We connect
              customers with local vendors and independent riders to deliver food, groceries and
              pharmacy items.
            </p>
          </div>
          <div>
            <h2 className="font-heading font-bold text-[15px] text-ink mb-2">Using the service</h2>
            <p className="text-[14px] text-ink-2 leading-relaxed">
              By placing an order you agree to pay the stated amount and provide a correct delivery
              address. Orders are subject to vendor availability. Dart may cancel orders that
              cannot be fulfilled and will issue a refund.
            </p>
          </div>
          <div>
            <h2 className="font-heading font-bold text-[15px] text-ink mb-2">Payments</h2>
            <p className="text-[14px] text-ink-2 leading-relaxed">
              Payments are processed securely via Monnify. Dart does not store your card details.
              All prices are in Nigerian Naira (₦) and include applicable fees.
            </p>
          </div>
          <p className="text-[12px] text-ink-2 pt-2 border-t border-line">
            Full terms of use will be published before our public launch. Last updated: November 2024.
          </p>
        </div>
      </div>
    </div>
  )
}
