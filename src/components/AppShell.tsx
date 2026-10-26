export function AppShell({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`min-h-dvh flex flex-col bg-white ${className}`}>
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
        {children}
      </div>
    </div>
  )
}
