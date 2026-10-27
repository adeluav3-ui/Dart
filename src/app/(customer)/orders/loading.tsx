import { Skeleton } from '@/components/ui/Skeleton'

export default function OrdersLoading() {
  return (
    <div className="min-h-dvh bg-canvas font-body"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>
      <div className="bg-white px-5 pt-5 pb-4">
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="px-4 pt-4 flex flex-col gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    </div>
  )
}
