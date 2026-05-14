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
        className="absolute inset-0 bg-black/75"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Contenu */}
      <div
        className={cn(
          'relative z-10 w-full mx-4 bg-mid-grey border border-electric-blue',
          sizeClasses[size]
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-electric-blue">
          <h2 id="modal-title" className="font-condensed font-bold uppercase text-lg text-white tracking-wide">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-light-grey/60 hover:text-red-alert transition-colors p-1"
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
          <div className="px-6 py-4 border-t border-electric-blue/30 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
