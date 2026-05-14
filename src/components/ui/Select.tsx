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
          className="text-xs font-sans text-light-grey/70 uppercase tracking-widest"
        >
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        className={cn(
          'bg-light-grey text-black',
          'border-0 border-b-2 border-electric-blue',
          'px-3 py-2 w-full',
          'font-sans text-sm',
          'outline-none focus:border-fluo-green',
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
        <span className="text-red-alert text-xs font-sans">{error}</span>
      )}
    </div>
  )
)
Select.displayName = 'Select'
