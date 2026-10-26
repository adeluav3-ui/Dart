import { clsx } from 'clsx'
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <label className="flex flex-col gap-1">
        {label && (
          <span className="text-xs font-semibold text-ink-2">{label}</span>
        )}
        <input
          ref={ref}
          className={clsx(
            'h-btn-sm px-3 rounded-xl border border-line bg-white font-body text-[15px] text-ink placeholder:text-ink-2/60 outline-none focus:border-brand transition-colors',
            error && 'border-danger',
            className
          )}
          {...props}
        />
        {error && (
          <span className="text-xs text-danger">{error}</span>
        )}
      </label>
    )
  }
)

Input.displayName = 'Input'
