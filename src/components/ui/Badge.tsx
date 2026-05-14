import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'active'

const variants: Record<BadgeVariant, string> = {
  default:  'bg-bg-strong text-ink',
  success:  'bg-green-fluo text-ink',
  active:   'bg-blue text-white',
  warning:  'bg-warn text-white',
  danger:   'bg-red text-white',
  info:     'bg-bg-strong text-ink-2',
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
        'inline-block px-2 py-0.5',
        'text-[11px] font-mono font-bold uppercase tracking-[0.08em]',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
