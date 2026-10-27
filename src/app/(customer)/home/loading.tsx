import { Skeleton } from '@/components/ui/Skeleton'

export default function HomeLoading() {
  return (
    <div className="min-h-dvh bg-white"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>

      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <Skeleton className="h-7 w-14" />
        <Skeleton className="w-9 h-9 rounded-full" />
      </div>

      {/* Area bar */}
      <div className="px-4 pb-3">
        <Skeleton className="h-11 rounded-2xl" />
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <Skeleton className="h-11 rounded-2xl" />
      </div>

      {/* Store type tabs */}
      <div className="px-4 pb-3 flex gap-2">
        {[72, 100, 88].map((w, i) => (
          <Skeleton key={i} className="h-8 rounded-full shrink-0" style={{ width: w }} />
        ))}
      </div>

      {/* Category chips */}
      <div className="px-4 pb-4 flex gap-2 overflow-hidden">
        {[64, 80, 56, 88, 72].map((w, i) => (
          <Skeleton key={i} className="h-8 rounded-full shrink-0" style={{ width: w }} />
        ))}
      </div>

      {/* Vendor cards */}
      <div className="px-4 flex flex-col gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl overflow-hidden border border-line">
            <Skeleton className="h-40 rounded-none" />
            <div className="p-3 flex flex-col gap-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
