'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

const SLIDES = [
  {
    title: 'Food, groceries and pharmacy in one app',
    body: 'Order from kitchens, supermarkets and pharmacies near you in Sagamu.',
    Illustration: () => (
      <div className="w-full max-w-[260px] mx-auto aspect-square rounded-3xl bg-brand-tint flex items-center justify-center">
        <svg width="96" height="96" viewBox="0 0 96 96" fill="none">
          <rect x="16" y="28" width="64" height="44" rx="8" fill="#0B7A47" opacity=".15" />
          <rect x="24" y="36" width="20" height="28" rx="4" fill="#0B7A47" opacity=".4" />
          <rect x="50" y="36" width="20" height="28" rx="4" fill="#0B7A47" opacity=".4" />
          <circle cx="34" cy="26" r="8" fill="#0B7A47" opacity=".5" />
          <circle cx="60" cy="26" r="8" fill="#F26A1B" opacity=".7" />
          <rect x="30" y="60" width="36" height="6" rx="3" fill="#0B7A47" opacity=".3" />
        </svg>
      </div>
    ),
  },
  {
    title: 'Pay once, we handle the rest',
    body: 'See every fee before you pay. The shop starts only after your payment is confirmed.',
    Illustration: () => (
      <div className="w-full max-w-[260px] mx-auto aspect-square rounded-3xl bg-brand-tint flex items-center justify-center">
        <svg width="96" height="96" viewBox="0 0 96 96" fill="none">
          <rect x="12" y="28" width="72" height="44" rx="10" fill="#0B7A47" opacity=".15" />
          <rect x="12" y="40" width="72" height="14" fill="#0B7A47" opacity=".2" />
          <circle cx="48" cy="60" r="10" fill="#0B7A47" opacity=".5" />
          <path d="M44 60l3 3 6-6" stroke="#0B7A47" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="24" y="46" width="16" height="4" rx="2" fill="white" opacity=".6" />
        </svg>
      </div>
    ),
  },
  {
    title: 'Delivered to your landmark',
    body: 'No street name needed. Tell us the landmark and your GoCart rider finds you.',
    Illustration: () => (
      <div className="w-full max-w-[260px] mx-auto aspect-square rounded-3xl bg-brand-tint flex flex-col items-center justify-center gap-4">
        <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-sm">
          <Logo variant="symbol" height={48} />
        </div>
        <div className="bg-white rounded-2xl px-4 py-2 shadow-sm">
          <span className="text-[13px] font-semibold text-ink">Opposite OOUTH</span>
        </div>
      </div>
    ),
  },
]

function complete(router: ReturnType<typeof useRouter>) {
  localStorage.setItem('dart_welcomed', '1')
  router.replace('/home')
}

export default function WelcomePage() {
  const router = useRouter()
  const [slide, setSlide] = useState(0)
  const touchStart = useRef<number | null>(null)
  const isLast = slide === SLIDES.length - 1

  function onTouchStart(e: React.TouchEvent) {
    touchStart.current = e.touches[0].clientX
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStart.current === null) return
    const diff = touchStart.current - e.changedTouches[0].clientX
    if (diff > 40 && slide < SLIDES.length - 1) setSlide(s => s + 1)
    if (diff < -40 && slide > 0) setSlide(s => s - 1)
    touchStart.current = null
  }

  const { title, body, Illustration } = SLIDES[slide]

  return (
    <div
      className="min-h-dvh bg-canvas flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <Logo height={28} />
        <button
          type="button"
          className="text-sm font-semibold text-ink-2 min-h-[44px] flex items-center"
          onClick={() => complete(router)}
        >
          Skip
        </button>
      </div>

      <div className="flex-1 flex flex-col px-6 pt-6 pb-4 select-none">
        <div className="flex-1 flex flex-col justify-center gap-6">
          <Illustration />

          <div className="flex flex-col gap-2">
            <h1 className="font-heading font-extrabold text-[26px] leading-tight tracking-tight text-ink">
              {title}
            </h1>
            <p className="text-[15px] text-ink-2 leading-relaxed">{body}</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 py-6">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSlide(i)}
              aria-label={`Slide ${i + 1}`}
              className={`rounded-full transition-all duration-200 ${
                i === slide
                  ? 'w-6 h-2.5 bg-brand'
                  : 'w-2.5 h-2.5 bg-line'
              }`}
            />
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              if (isLast) {
                complete(router)
              } else {
                setSlide(s => s + 1)
              }
            }}
            className="h-btn w-full rounded-2xl bg-brand text-white font-heading font-bold text-base"
          >
            {isLast ? 'Start ordering' : 'Next'}
          </button>

          <p className="text-center text-sm text-ink-2">
            Already have an account?{' '}
            <Link href="/login" className="text-brand font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
