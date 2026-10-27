export default function HomeLoading() {
  return (
    <div className="min-h-dvh bg-white animate-pulse">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="h-7 w-20 bg-surface rounded-lg" />
        <div className="w-9 h-9 rounded-full bg-surface" />
      </div>

      {/* Area bar */}
      <div className="px-4 pb-3">
        <div className="h-11 rounded-2xl bg-surface" />
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="h-11 rounded-2xl bg-surface" />
      </div>

      {/* Category chips */}
      <div className="px-4 pb-3 flex gap-2 overflow-hidden">
        {[80, 100, 70, 90, 80].map((w, i) => (
          <div key={i} className="h-8 rounded-full bg-surface shrink-0" style={{ width: w }} />
        ))}
      </div>

      {/* Vendor cards */}
      <div className="px-4 flex flex-col gap-3 pt-1">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl overflow-hidden bg-surface">
            <div className="h-40 bg-photo" />
            <div className="p-3 flex flex-col gap-2">
              <div className="h-5 w-2/3 bg-line rounded" />
              <div className="h-4 w-1/2 bg-line rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
