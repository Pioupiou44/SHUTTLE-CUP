import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label
          htmlFor={id}
          className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={cn(
          'bg-bg text-ink',
          'border border-line hover:border-blue focus:border-blue',
          'px-3 py-2 w-full min-h-[44px]',
          'font-sans text-[14px]',
          'outline-none transition-colors duration-150',
          'placeholder:text-ink-3',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      />
      {error && (
        <span className="text-warn text-[12px] font-sans">{error}</span>
      )}
    </div>
  )
)
Input.displayName = 'Input'
