import type { ReactNode } from 'react'

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas font-body text-ink">
      {children}
    </div>
  )
}
