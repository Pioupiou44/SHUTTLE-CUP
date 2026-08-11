import { useEffect, useRef } from 'react'
import { useTournamentsStore } from '@/store/tournamentsStore'

/**
 * Bandeau bas 30px — défilement des scores live en cours.
 * Visible uniquement si au moins un tournoi est en cours.
 */
export function Ticker() {
  const { tournaments } = useTournamentsStore()
  const tickerRef = useRef<HTMLDivElement>(null)

  const activeTournaments = tournaments.filter((t) => t.status === 'active')

  // Défilement CSS via animation
  useEffect(() => {
    const el = tickerRef.current
    if (!el) return
    el.style.animationDuration = `${Math.max(15, el.scrollWidth / 80)}s`
  }, [activeTournaments])

  if (activeTournaments.length === 0) return null

  const items = activeTournaments.flatMap((t) => [
    { key: t.id, text: t.name.toUpperCase(), score: null },
  ])

  return (
    <footer className="flex items-center h-[30px] bg-ink border-t border-line shrink-0 overflow-hidden print:hidden">
      {/* Badge fixe */}
      <div className="flex items-center px-3 h-full bg-ink shrink-0 border-r border-line">
        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.1em] text-green-fluo">
          Scores live
        </span>
      </div>

      {/* Défilement */}
      <div className="flex-1 overflow-hidden relative">
        <div
          ref={tickerRef}
          className="flex items-center gap-8 whitespace-nowrap animate-[ticker_20s_linear_infinite]"
          style={{ paddingLeft: '16px' }}
        >
          {items.map((item) => (
            <span key={item.key} className="text-[11px] font-mono font-bold text-blue tracking-[0.05em]">
              {item.text}
            </span>
          ))}
          {/* Séparateur visuel de boucle */}
          <span className="text-ink-3 text-[11px] font-mono">·</span>
        </div>
      </div>
    </footer>
  )
}
