// SidePanel — volet latéral droit, rétractable, adapté tablette.
// Conçu pour les pages à split 60/40 (Configuration, Assistant tournoi) :
// - ≥1024px (lg) : volet dans le flux (40% de largeur). Fermé → sort du flux,
//   la zone principale prend toute la largeur.
// - <1024px (tablette portrait, mobiles) : fermé par défaut — la zone
//   principale occupe tout ; le volet s'ouvre en superposition (fixed)
//   par-dessus le contenu, refermable via le bouton.
// Design system : angles droits, bordures 2px line, fond papier alterné.

import { useEffect, useRef, useState } from 'react'
import { PanelRightOpen, PanelRightClose } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidePanelProps {
  /** Titre affiché dans la barre supérieure du volet (mono uppercase). */
  title: string
  /** Contenu du volet. */
  children: React.ReactNode
}

/** Viewport ≥1024px (lg), mis à jour au resize / rotation. */
function useIsLarge(): boolean {
  const [isLarge, setIsLarge] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => setIsLarge(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isLarge
}

export function SidePanel({ title, children }: SidePanelProps) {
  const isLarge = useIsLarge()
  // Ouvert par défaut en desktop/paysage, fermé en portrait compact.
  const [open, setOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  )

  // Suit les transitions de taille : desktop → portrait referme, portrait →
  // desktop rouvre. Couvre aussi le boot du WebView (démarre parfois étroit
  // avant son layout final) : l'état converge vers le bon côté du seuil.
  const prevIsLarge = useRef(isLarge)
  useEffect(() => {
    if (prevIsLarge.current !== isLarge) {
      setOpen(isLarge)
      prevIsLarge.current = isLarge
    }
  }, [isLarge])

  return (
    <>
      {/* Poignée d'ouverture — visible quand le volet est fermé */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={cn(
            'fixed right-0 top-1/2 -translate-y-1/2 z-40',
            'flex items-center justify-center w-11 h-14',
            'bg-ink text-green-fluo border-y-2 border-l-2 border-line',
            'hover:bg-blue hover:text-white transition-colors',
            'print:hidden'
          )}
          aria-label={`Ouvrir le volet « ${title} »`}
          title={`Ouvrir le volet « ${title} »`}
        >
          <PanelRightOpen size={18} />
        </button>
      )}

      {/* Volet */}
      <aside
        className={cn(
          'print:hidden',
          isLarge
            ? // ≥1024px : dans le flux — fermé = sort du flux (largeur libre)
              cn(
                'static shrink-0 bg-bg-alt border-l-2 border-line',
                'w-[40%] max-w-[520px] min-w-[340px]',
                open ? 'block' : 'hidden'
              )
            : // <1024px : superposition animée par-dessus le contenu
              cn(
                'fixed right-0 top-0 bottom-0 z-30',
                'w-[min(92vw,420px)] bg-bg-alt border-l-2 border-line',
                'transition-transform duration-200 ease-out',
                open ? 'translate-x-0' : 'translate-x-full pointer-events-none'
              )
        )}
        aria-hidden={!open}
      >
        {/* Barre supérieure : titre + fermeture */}
        <div className="flex items-center justify-between gap-2 h-12 px-4 border-b-2 border-line shrink-0">
          <span className="font-mono font-bold text-[11px] uppercase tracking-[0.08em] text-ink-3 truncate">
            {title}
          </span>
          <button
            onClick={() => setOpen(false)}
            className="flex items-center justify-center w-11 h-11 -mr-2 text-ink-3 hover:text-red transition-colors"
            aria-label={`Fermer le volet « ${title} »`}
            title="Réduire le volet"
          >
            <PanelRightClose size={18} />
          </button>
        </div>

        {/* Contenu scrollable */}
        <div className="overflow-y-auto scrollbar-light h-[calc(100%-3rem)]">
          {children}
        </div>
      </aside>
    </>
  )
}