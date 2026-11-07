'use client'

import { useState } from 'react'

export default function AdminSettingsPage() {
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function sendTestEmail() {
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/test-email', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, message: 'Test email sent — check your inbox.' })
      } else {
        setResult({ ok: false, message: data.error ?? 'Failed to send email.' })
      }
    } catch {
      setResult({ ok: false, message: 'Network error — could not reach the server.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas font-body text-ink pb-16">
      <header className="bg-white px-5 pt-6 pb-4 border-b border-line">
        <h1 className="font-heading font-extrabold text-xl">Settings</h1>
        <p className="text-sm text-ink-2 mt-1">Platform configuration and diagnostics.</p>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">

        <section className="bg-white rounded-2xl p-4 flex flex-col gap-3">
          <div>
            <h2 className="font-bold text-base">Email</h2>
            <p className="text-xs text-ink-2 mt-0.5">
              Verify that transactional email is working correctly.
            </p>
          </div>

          {result && (
            <p className={`text-sm font-medium ${result.ok ? 'text-brand-ink' : 'text-danger'}`}>
              {result.message}
            </p>
          )}

          <button
            type="button"
            disabled={sending}
            onClick={sendTestEmail}
            className="h-10 rounded-xl bg-brand text-white font-bold text-sm border-0 disabled:opacity-50 self-start px-5"
          >
            {sending ? 'Sending…' : 'Send test email'}
          </button>
        </section>

      </div>
    </div>
  )
}
