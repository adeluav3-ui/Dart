export default function TrackLoading() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="px-5 pt-4 pb-6 bg-brand flex flex-col gap-2">
        <div className="h-4 w-32 rounded-full bg-white/20" />
        <div className="h-8 w-48 rounded-2xl bg-white/20" />
        <div className="h-4 w-40 rounded-full bg-white/20" />
      </div>
      <div className="flex flex-col gap-4 pt-5 px-5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex gap-3.5">
            <div className="w-6 h-6 rounded-full bg-line shrink-0" />
            <div className="flex flex-col gap-1.5 pt-0.5">
              <div className="h-4 w-36 rounded-full bg-line" />
              <div className="h-3 w-20 rounded-full bg-line/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
