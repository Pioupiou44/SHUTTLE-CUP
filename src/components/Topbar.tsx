import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  end?: boolean
}

const navItems: NavItem[] = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/players', label: 'Joueurs' },
  { to: '/tournaments', label: 'Tournois' },
  { to: '/settings', label: 'Préférences' },
]

export function Topbar() {
  const [time, setTime] = useState(() => formatTime(new Date()))

  useEffect(() => {
    const id = setInterval(() => setTime(formatTime(new Date())), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="flex items-stretch h-12 bg-bg border-b-2 border-line shrink-0">
      {/* Logo : carré vert-fluo + fond noir + texte blanc */}
      <div className="flex items-center px-4 border-r-2 border-line shrink-0 gap-3 bg-ink">
        <div className="w-5 h-5 bg-green-fluo shrink-0" />
        <span className="font-sans font-black uppercase text-[15px] tracking-[0.06em] text-white leading-none">
          SHUTTLE/CUP
        </span>
      </div>

      {/* Navigation principale */}
      <nav className="flex items-stretch flex-1" aria-label="Navigation principale">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'relative flex items-center px-5 h-full',
                'font-sans uppercase text-[12px] tracking-[0.05em]',
                'transition-colors duration-150',
                isActive
                  ? 'font-extrabold text-ink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-blue'
                  : 'font-bold text-ink-2 hover:text-ink'
              )
            }
          >
            {item.label}
          </NavLink>
        ))}

        {/* Lien Dev UI — masqué en production */}
        {import.meta.env.DEV && (
          <NavLink
            to="/dev-ui"
            className={({ isActive }) =>
              cn(
                'relative flex items-center px-5 h-full ml-auto',
                'font-mono font-bold uppercase text-[11px] tracking-[0.08em]',
                'transition-colors duration-150',
                isActive
                  ? 'text-blue after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-blue'
                  : 'text-ink-3 hover:text-ink-2'
              )
            }
          >
            Dev UI
          </NavLink>
        )}
      </nav>

      {/* Zone droite : horloge */}
      <div className="flex items-center px-4 border-l-2 border-line shrink-0 gap-3">
        <span className="font-mono font-bold text-[12px] text-ink-2 tracking-[0.05em]">
          {time}
        </span>
      </div>
    </header>
  )
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
