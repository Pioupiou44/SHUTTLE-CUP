import { cn } from '@/lib/utils'

interface TagProps {
  label: string
  onRemove?: () => void
  active?: boolean
  className?: string
}

export function Tag({ label, onRemove, active = false, className }: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 text-xs font-condensed uppercase tracking-wide',
        'border transition-colors duration-150',
        active
          ? 'border-fluo-green text-fluo-green'
          : 'border-electric-blue text-electric-blue',
        className
      )}
    >
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          className="hover:text-red-alert transition-colors leading-none"
          aria-label={`Retirer ${label}`}
          type="button"
        >
          ×
        </button>
      )}
    </span>
  )
}
