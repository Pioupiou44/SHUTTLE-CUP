import { SelectHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, id, ...props }, ref) => (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label
          htmlFor={id}
          className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3"
        >
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        className={cn(
          'bg-bg text-ink',
          'border border-line hover:border-blue focus:border-blue',
          'px-3 py-2 w-full min-h-[44px]',
          'font-sans text-[14px]',
          'outline-none transition-colors duration-150',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'cursor-pointer',
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span className="text-warn text-[12px] font-sans">{error}</span>
      )}
    </div>
  )
)
Select.displayName = 'Select'
