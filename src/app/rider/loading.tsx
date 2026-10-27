import { Skeleton } from '@/components/ui/Skeleton'

export default function RiderLoading() {
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="bg-white px-5 pt-5 pb-4 border-b border-line flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-20 rounded-xl" />
      </div>
      <div className="px-4 pt-4 flex flex-col gap-4">
        <div className="bg-white rounded-2xl p-5 flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
        {[1, 2].map(i => (
          <div key={i} className="bg-white rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-36" />
          </div>
        ))}
      </div>
    </div>
  )
}
