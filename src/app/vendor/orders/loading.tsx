import { Skeleton } from '@/components/ui/Skeleton'

export default function VendorOrdersLoading() {
  return (
    <div className="min-h-screen bg-canvas pb-28">
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-3 border-b border-line flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-16 rounded-xl" />
      </div>

      {/* Nav tabs */}
      <div className="bg-white border-b border-line flex">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="flex-1 h-12 rounded-none mx-1 my-1" />
        ))}
      </div>

      <div className="px-4 pt-4 flex flex-col gap-3">
        {/* Setup checklist or order cards */}
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-36" />
          </div>
        ))}
      </div>
    </div>
  )
}
