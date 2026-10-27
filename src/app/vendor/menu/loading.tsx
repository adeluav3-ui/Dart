import { Skeleton } from '@/components/ui/Skeleton'

export default function VendorMenuLoading() {
  return (
    <div className="min-h-screen bg-canvas pb-28">
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-3 border-b border-line flex items-center justify-between">
        <Skeleton className="h-6 w-16" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-xl" />
          <Skeleton className="h-8 w-8 rounded-xl" />
        </div>
      </div>

      {/* Nav tabs */}
      <div className="bg-white border-b border-line flex">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="flex-1 h-12 rounded-none mx-1 my-1" />
        ))}
      </div>

      {/* Category chips */}
      <div className="px-4 py-3 flex gap-2 overflow-hidden">
        {[48, 72, 64, 80].map((w, i) => (
          <Skeleton key={i} className="h-8 rounded-full shrink-0" style={{ width: w }} />
        ))}
      </div>

      {/* Item rows */}
      <div className="px-4 flex flex-col gap-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-white rounded-2xl p-3 flex items-center gap-3">
            <Skeleton className="w-16 h-16 rounded-xl shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-8 w-16 rounded-xl shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
