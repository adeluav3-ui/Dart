export default function VendorLoading() {
  return (
    <div className="min-h-dvh bg-canvas animate-pulse">
      {/* Cover photo */}
      <div className="h-52 bg-photo w-full" />

      {/* Back button placeholder */}
      <div className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/60" />

      {/* Vendor info */}
      <div className="bg-white px-4 pt-4 pb-3 flex flex-col gap-2">
        <div className="h-6 w-48 bg-surface rounded-lg" />
        <div className="h-4 w-32 bg-surface rounded" />
        <div className="flex gap-3 mt-1">
          <div className="h-4 w-20 bg-surface rounded" />
          <div className="h-4 w-20 bg-surface rounded" />
        </div>
      </div>

      {/* Category chips */}
      <div className="px-4 py-3 flex gap-2 overflow-hidden bg-white border-b border-line">
        {[70, 90, 60, 80].map((w, i) => (
          <div key={i} className="h-8 rounded-full bg-surface shrink-0" style={{ width: w }} />
        ))}
      </div>

      {/* Menu items */}
      <div className="px-4 pt-4 flex flex-col gap-3">
        <div className="h-4 w-24 bg-surface rounded" />
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl p-3 flex gap-3">
            <div className="flex-1 flex flex-col gap-2">
              <div className="h-5 w-3/4 bg-surface rounded" />
              <div className="h-4 w-full bg-surface rounded" />
              <div className="h-4 w-1/3 bg-surface rounded" />
            </div>
            <div className="w-20 h-20 rounded-xl bg-photo shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
