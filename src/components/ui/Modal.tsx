import { ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  footer?: ReactNode
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

export function Modal({ isOpen, onClose, title, children, size = 'md', footer }: ModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-ink/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Contenu */}
      <div
        className={cn(
          'relative z-10 w-full mx-4 bg-bg border-2 border-line',
          sizeClasses[size]
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-line">
          <h2
            id="modal-title"
            className="font-sans font-black uppercase text-[18px] tracking-[-0.01em] text-ink"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-ink-3 hover:text-red transition-colors p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Fermer"
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corps */}
        <div className="px-6 py-4">{children}</div>

        {/* Pied (optionnel) */}
        {footer && (
          <div className="px-6 py-4 border-t border-line-soft flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
