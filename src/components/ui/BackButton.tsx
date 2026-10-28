'use client'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export function BackButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="w-9 h-9 rounded-full bg-surface flex items-center justify-center shrink-0"
    >
      <ArrowLeft size={18} />
    </button>
  )
}
