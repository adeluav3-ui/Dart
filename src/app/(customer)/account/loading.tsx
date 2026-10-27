import { Skeleton } from '@/components/ui/Skeleton'

export default function AccountLoading() {
  return (
    <div className="min-h-dvh bg-canvas"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>
      <div className="bg-white px-5 pt-5 pb-4">
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="px-4 pt-4 flex flex-col gap-3">
        {/* Profile card */}
        <div className="bg-white rounded-2xl p-4 flex items-center gap-4">
          <Skeleton className="w-14 h-14 rounded-full shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-8 w-12 rounded-lg shrink-0" />
        </div>
        {/* Section rows */}
        {[1, 2].map(i => (
          <div key={i} className="bg-white rounded-2xl overflow-hidden">
            {[1, 2].map(j => (
              <div key={j} className="flex items-center gap-3 px-4 py-3.5 border-b border-line last:border-0">
                <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        ))}
        <Skeleton className="h-[52px] rounded-2xl" />
      </div>
    </div>
  )
}
