// Sidebar de navigation pour écrans compacts (< 1024px : tablette portrait,
// mobiles). Desktop (lg:) utilise la Topbar horizontale.
// Design system « Live Sport · Mode Clair » : fond noir, texte vert-fluo pour
// l'actif (fills uniquement → le texte blanc reste lisible), angles droits.

import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Trophy,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  icon: React.ElementType
  label: string
  end?: boolean
}

const navItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Accueil', end: true },
  { to: '/players', icon: Users, label: 'Joueurs' },
  { to: '/tournaments', icon: Trophy, label: 'Tournois' },
  { to: '/settings', icon: Settings, label: 'Préférences' },
]

function SidebarLink({ to, icon: Icon, label, end }: NavItem) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center justify-center gap-1 w-full min-h-[64px] py-2',
          'border-b-[1.5px] border-line-soft transition-colors duration-150',
          isActive ? 'bg-ink' : 'hover:bg-bg-alt'
        )
      }
      aria-label={label}
    >
      {({ isActive }) => (
        <>
          <Icon
            size={24}
            strokeWidth={isActive ? 2.5 : 1.75}
            className={isActive ? 'text-green-fluo' : 'text-ink-2'}
          />
          <span
            className={cn(
              'font-mono font-bold uppercase text-[9px] tracking-[0.06em] leading-none',
              isActive ? 'text-white' : 'text-ink-2'
            )}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  )
}

export function MobileNav() {
  return (
    <nav
      className="flex flex-col w-[76px] shrink-0 bg-bg-alt border-r-2 border-line print:hidden"
      aria-label="Navigation principale"
    >
      {/* Logo : carré noir + carré vert-fluo (identité Topbar) */}
      <div className="flex items-center justify-center h-14 border-b-2 border-line bg-ink shrink-0">
        <span className="w-5 h-5 bg-green-fluo" aria-hidden="true" />
      </div>

      {/* Liens */}
      <div className="flex flex-col w-full">
        {navItems.map((item) => (
          <SidebarLink key={item.to} {...item} />
        ))}
      </div>

      {/* Horloge + version en bas */}
      <div className="mt-auto flex flex-col items-center gap-2 py-3 border-t-2 border-line">
        <span className="font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-ink-3 select-none">
          BETA
        </span>
        <span className="font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-ink-3 select-none">
          1.0.3
        </span>
      </div>
    </nav>
  )
}