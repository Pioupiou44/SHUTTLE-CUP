import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Trophy,
  Settings,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  icon: React.ElementType
  label: string
}

const navItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/players', icon: Users, label: 'Joueurs' },
  { to: '/tournaments', icon: Trophy, label: 'Tournois' },
  { to: '/settings', icon: Settings, label: 'Paramètres' },
]

function SidebarLink({ to, icon: Icon, label }: NavItem) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'relative group w-full flex justify-center py-3.5 transition-colors duration-150',
          isActive
            ? 'text-fluo-green border-r-2 border-fluo-green bg-white/5'
            : 'text-light-grey/60 hover:text-white hover:bg-white/5'
        )
      }
      aria-label={label}
    >
      <Icon size={22} strokeWidth={1.5} />

      {/* Tooltip au survol */}
      <span
        className={cn(
          'absolute left-full ml-2 px-3 py-1.5 z-50',
          'bg-mid-grey text-white text-xs font-condensed uppercase tracking-wide',
          'border border-electric-blue',
          'whitespace-nowrap pointer-events-none',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-150'
        )}
      >
        {label}
      </span>
    </NavLink>
  )
}

export function Sidebar() {
  return (
    <nav
      className="flex flex-col items-center w-[72px] min-h-screen bg-black shrink-0 py-3"
      aria-label="Navigation principale"
    >
      {/* Logo mark */}
      <div className="w-10 h-10 bg-electric-blue flex items-center justify-center mb-6 shrink-0">
        <span className="font-condensed font-bold text-white text-base leading-none">SD</span>
      </div>

      {/* Liens de navigation */}
      <div className="flex flex-col w-full flex-1 gap-0.5">
        {navItems.map((item) => (
          <SidebarLink key={item.to} {...item} />
        ))}
      </div>

      {/* Lien Dev UI — masqué en production */}
      {import.meta.env.DEV && (
        <NavLink
          to="/dev-ui"
          className={({ isActive }) =>
            cn(
              'relative group w-full flex justify-center py-3 transition-colors duration-150 mt-auto',
              isActive ? 'text-fluo-green' : 'text-white/20 hover:text-white/60'
            )
          }
          aria-label="Dev UI"
        >
          <Layers size={18} strokeWidth={1.5} />
          <span
            className={cn(
              'absolute left-full ml-2 px-3 py-1.5 z-50',
              'bg-mid-grey text-white text-xs font-condensed uppercase',
              'border border-electric-blue whitespace-nowrap pointer-events-none',
              'opacity-0 group-hover:opacity-100 transition-opacity duration-150'
            )}
          >
            Dev UI
          </span>
        </NavLink>
      )}
    </nav>
  )
}
