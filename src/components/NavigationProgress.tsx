'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, Suspense } from 'react'

function Bar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [width, setWidth] = useState(0)
  const [opacity, setOpacity] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  function clear() {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  function startProgress() {
    clear()
    setOpacity(1)
    setWidth(15)
    timers.current.push(setTimeout(() => setWidth(40), 100))
    timers.current.push(setTimeout(() => setWidth(65), 400))
    timers.current.push(setTimeout(() => setWidth(80), 900))
  }

  function completeProgress() {
    clear()
    setWidth(100)
    timers.current.push(setTimeout(() => setOpacity(0), 200))
    timers.current.push(setTimeout(() => setWidth(0), 500))
  }

  // Detect navigation completion via pathname change
  useEffect(() => {
    completeProgress()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  // Intercept internal link clicks to start the bar
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href') ?? ''
      // Only intercept same-origin navigation links
      if (!href || href.startsWith('#') || href.startsWith('http') ||
          href.startsWith('tel:') || href.startsWith('mailto:')) return
      startProgress()
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 right-0 z-[9999] h-[3px] bg-brand"
      style={{
        width: `${width}%`,
        opacity,
        transition: width === 100
          ? 'width 150ms ease-out'
          : 'width 300ms ease-out, opacity 300ms ease-out',
      }}
    />
  )
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  )
}
