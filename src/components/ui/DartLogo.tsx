import { clsx } from 'clsx'

export function DartLogo({ className }: { className?: string }) {
  return (
    <div className={clsx('flex items-center gap-1.5', className)}>
      <svg width="30" height="30" viewBox="0 0 120 120" role="img" aria-label="Dart">
        <circle cx="50" cy="74" r="32" fill="none" stroke="#0B7A47" strokeWidth="14" />
        <circle cx="50" cy="74" r="10" fill="#F26A1B" />
        <polygon points="82,24 96,12 96,113 82,113" fill="#0B7A47" />
      </svg>
      <span
        aria-hidden="true"
        className="font-heading font-extrabold text-[30px] leading-none tracking-tight text-ink"
        style={{ marginTop: -4 }}
      >
        dart
      </span>
    </div>
  )
}
