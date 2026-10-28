'use client'
import { useEffect } from 'react'

interface Props {
  message: string
  onDismiss: () => void
}

export function Toast({ message, onDismiss }: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] px-5 py-3 rounded-2xl bg-ink text-white text-[14px] font-semibold shadow-xl max-w-[90vw] text-center pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200">
      {message}
    </div>
  )
}
