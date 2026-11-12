'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Props {
  slugs: string[]
  titles: string[]
  docHrefs: string[]
  role: string
  next: string
}

export function ReAcceptClient({ slugs, titles, docHrefs, role, next }: Props) {
  const [agreed, setAgreed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const title = titles.length === 1 ? titles[0] : titles.join(' and ')

  async function handleAccept() {
    if (!agreed) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/legal/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slugs, role }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError((j as { error?: string }).error ?? 'Something went wrong. Please try again.')
      return
    }
    router.push(next)
  }

  return (
    <div className="min-h-dvh bg-canvas font-body text-ink flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <div className="w-14 h-14 rounded-full bg-warn-tint flex items-center justify-center mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8A4B08" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h1 className="font-heading font-extrabold text-[22px] text-ink leading-tight">
            We&apos;ve updated our {title}
          </h1>
          <p className="text-[14px] text-ink-2 leading-snug">
            Please review the changes and accept to keep using GoCart.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {docHrefs.map((href, i) => (
            <Link
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between h-12 px-4 rounded-xl border border-line bg-white text-[14px] font-semibold text-brand no-underline"
            >
              Read {titles[i]}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </Link>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setAgreed(v => !v)}
          className="flex items-start gap-3 text-left"
        >
          <div className={`mt-0.5 w-5 h-5 rounded shrink-0 flex items-center justify-center border-2 transition-colors ${
            agreed ? 'bg-brand border-brand' : 'border-line'
          }`}>
            {agreed && (
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          <span className="text-[13px] text-ink leading-snug">
            I agree to the updated {title}.
          </span>
        </button>

        {error && <p className="text-[13px] text-danger">{error}</p>}

        <button
          type="button"
          disabled={!agreed || saving}
          onClick={handleAccept}
          className="h-14 rounded-2xl bg-brand text-white font-bold text-[16px] border-0 disabled:opacity-40 transition-opacity"
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
