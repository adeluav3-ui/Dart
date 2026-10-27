import { Skeleton } from '@/components/ui/Skeleton'

export default function ItemEditLoading() {
  return (
    <div className="min-h-dvh bg-canvas pb-10">
      <div className="bg-white px-4 pt-5 pb-4 flex items-center gap-3 border-b border-line">
        <Skeleton className="w-9 h-9 rounded-full shrink-0" />
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="px-4 pt-4 flex flex-col gap-5">
        <Skeleton className="h-48 w-full rounded-2xl" />
        {[1, 2, 3].map(i => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-11 rounded-xl" />
          </div>
        ))}
        <Skeleton className="h-14 rounded-2xl" />
      </div>
    </div>
  )
}
