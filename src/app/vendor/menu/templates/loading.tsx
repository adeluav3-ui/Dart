import { Skeleton } from '@/components/ui/Skeleton'

export default function TemplatesLoading() {
  return (
    <div className="min-h-dvh bg-canvas pb-10">
      <div className="bg-white px-4 pt-5 pb-4 flex items-center gap-3 border-b border-line">
        <Skeleton className="w-9 h-9 rounded-full shrink-0" />
        <Skeleton className="h-6 w-36" />
      </div>
      <div className="px-4 pt-4 flex flex-col gap-4">
        {/* Segment control */}
        <div className="flex gap-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="flex-1 h-10 rounded-xl" />)}
        </div>
        {/* Pack sections */}
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl p-4 flex flex-col gap-3">
            <Skeleton className="h-5 w-32" />
            {[1, 2, 3, 4].map(j => (
              <div key={j} className="flex items-center gap-3">
                <Skeleton className="w-5 h-5 rounded shrink-0" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ))}
        <Skeleton className="h-14 rounded-2xl" />
      </div>
    </div>
  )
}
