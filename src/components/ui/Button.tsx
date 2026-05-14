import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-electric-blue text-white border-2 border-electric-blue hover:bg-blue-700 hover:border-blue-700',
  secondary:
    'bg-transparent text-electric-blue border-2 border-electric-blue hover:bg-electric-blue hover:text-white',
  danger:
    'bg-red-alert text-white border-2 border-red-alert hover:opacity-90',
  ghost:
    'bg-transparent text-white border-2 border-white/40 hover:border-white hover:bg-white/10',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-1.5 text-sm',
  md: 'px-8 py-3 text-base',
  lg: 'px-12 py-4 text-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'font-condensed font-bold uppercase tracking-wider',
        'transition-colors duration-150 cursor-pointer',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
)
Button.displayName = 'Button'
