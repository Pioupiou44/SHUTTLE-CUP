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
          className="text-xs font-sans text-light-grey/70 uppercase tracking-widest"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={cn(
          'bg-light-grey text-black',
          'border-0 border-b-2 border-electric-blue',
          'px-3 py-2 w-full',
          'font-sans text-sm',
          'outline-none focus:border-fluo-green',
          'placeholder:text-gray-500',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      />
      {error && (
        <span className="text-red-alert text-xs font-sans">{error}</span>
      )}
    </div>
  )
)
Input.displayName = 'Input'
