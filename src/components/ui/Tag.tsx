import { cn } from '@/lib/utils'

type TagColor = 'H' | 'F' | 'SH' | 'SD' | 'DH' | 'DD' | 'DX' | 'default' | 'active'

const colorClasses: Record<TagColor, string> = {
  H:       'bg-blue text-white',
  SH:      'bg-blue text-white',
  DH:      'bg-blue text-white',
  F:       'bg-green-fluo text-ink',
  SD:      'bg-green-fluo text-ink',
  DD:      'bg-green-fluo text-ink',
  DX:      'bg-ink text-green-fluo',
  default: 'bg-bg-strong text-ink border border-line-soft',
  active:  'bg-ink text-green-fluo',
}

interface TagProps {
  label: string
  color?: TagColor
  onRemove?: () => void
  className?: string
}

export function Tag({ label, color = 'default', onRemove, className }: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1',
        'text-[11px] font-mono font-bold uppercase tracking-[0.08em]',
        colorClasses[color],
        className
      )}
    >
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          className="hover:opacity-60 transition-opacity leading-none"
          aria-label={`Retirer ${label}`}
          type="button"
        >
          ×
        </button>
      )}
    </span>
  )
}
