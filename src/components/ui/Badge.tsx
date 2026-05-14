import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'active'

const variants: Record<BadgeVariant, string> = {
  default: 'bg-mid-grey text-white',
  success: 'bg-fluo-green text-black',
  active: 'bg-fluo-green text-black',
  warning: 'bg-yellow-500 text-black',
  danger: 'bg-red-alert text-white',
  info: 'bg-electric-blue text-white',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-block px-2 py-0.5 text-xs font-condensed font-bold uppercase tracking-wide',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
