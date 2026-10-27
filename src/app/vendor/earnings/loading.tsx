import { Skeleton } from '@/components/ui/Skeleton'

export default function VendorEarningsLoading() {
  return (
    <div className="min-h-screen bg-canvas pb-28">
      <div className="bg-white px-5 pt-5 pb-3 border-b border-line">
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="bg-white border-b border-line flex">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="flex-1 h-12 rounded-none mx-1 my-1" />
        ))}
      </div>
      <div className="px-4 py-4 flex flex-col gap-4">
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-36" />
          <div className="flex gap-3">
            <Skeleton className="flex-1 h-16 rounded-xl" />
            <Skeleton className="flex-1 h-16 rounded-xl" />
          </div>
        </div>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-2xl p-4 flex items-center justify-between">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
