import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantClasses: Record<ButtonVariant, string> = {
  // Fond noir, texte vert-fluo — CTA principal
  primary:
    'bg-ink text-green-fluo border-2 border-ink hover:bg-ink/80 hover:border-ink/80',
  // Fond papier, bordure noire — action secondaire
  secondary:
    'bg-bg text-ink border-2 border-line hover:bg-bg-strong',
  // Fond rouge — destruction / annulation critique
  danger:
    'bg-red text-white border-2 border-red hover:opacity-90',
  // Transparent, bordure douce — action tertiaire
  ghost:
    'bg-transparent text-ink-2 border-2 border-line-soft hover:border-line hover:bg-bg-alt',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-[12px] min-h-[36px]',
  md: 'px-6 py-3 text-[13px] min-h-[44px]',
  lg: 'px-8 py-4 text-[14px] min-h-[56px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'font-sans font-black uppercase tracking-[0.05em]',
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
