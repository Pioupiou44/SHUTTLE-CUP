import { useEffect } from 'react'
import { Trophy, Users, Activity, Plus, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTournamentsStore } from '@/store/tournamentsStore'
import { usePlayersStore } from '@/store/playersStore'
import { Button, Badge } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import type { TournamentStatus } from '@/types/domain'

const STATUS_LABELS: Record<TournamentStatus, string> = {
  draft: 'Brouillon',
  active: 'En cours',
  completed: 'Terminé',
  archived: 'Archivé',
}

const STATUS_VARIANTS: Record<TournamentStatus, 'default' | 'info' | 'success' | 'active'> = {
  draft: 'default',
  active: 'active',
  completed: 'success',
  archived: 'default',
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  accent?: boolean
}) {
  return (
    <div className="bg-bg border-l-4 border-line p-5 flex items-center gap-4">
      <div className={`p-2 ${accent ? 'text-green' : 'text-blue'}`}>
        <Icon size={32} strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3">{label}</p>
        <p className="font-sans font-black text-page-title tracking-[-0.03em] text-ink leading-none mt-1">{value}</p>
      </div>
    </div>
  )
}

export function Dashboard() {
  const navigate = useNavigate()
  const { tournaments, fetchTournaments, isLoading } = useTournamentsStore()
  const { players, fetchPlayers } = usePlayersStore()

  useEffect(() => {
    void fetchTournaments()
    void fetchPlayers()
  }, [fetchTournaments, fetchPlayers])

  const activeTournaments = tournaments.filter((t) => t.status === 'active')
  const recentTournaments = [...tournaments].slice(0, 5)

  return (
    <div className="p-8 max-w-5xl">
      {/* En-tête */}
      <div className="mb-8">
        <h1 className="font-sans font-black uppercase text-page-title tracking-[-0.03em] text-ink leading-none">
          Accueil
        </h1>
        <p className="font-sans text-[14px] text-ink-3 mt-1">
          Gestionnaire de tournois de badminton
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard icon={Trophy} label="Tournois" value={tournaments.length} />
        <StatCard icon={Users} label="Joueurs" value={players.length} />
        <StatCard icon={Activity} label="En cours" value={activeTournaments.length} accent />
      </div>

      {/* Tournois récents */}
      <div className="bg-bg border-2 border-line mb-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-electric-blue/30">
          <h2 className="font-sans font-black uppercase text-[13px] tracking-[0.05em] text-ink">
            Tournois récents
          </h2>
          <Button
            size="sm"
            onClick={() => navigate('/tournaments')}
          >
            <Plus size={14} className="inline mr-1" />
            Nouveau tournoi
          </Button>
        </div>

        {isLoading ? (
          <div className="px-6 py-8 text-center text-[14px] font-sans text-ink-3">
            Chargement…
          </div>
        ) : recentTournaments.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Trophy size={48} className="text-electric-blue/20 mx-auto mb-4" />
            <p className="font-sans font-black uppercase text-[18px] text-ink-3 mb-2">
              Aucun tournoi
            </p>
            <p className="font-sans text-[14px] text-ink-3 mb-6">
              Créez votre premier tournoi pour commencer
            </p>
            <Button onClick={() => navigate('/tournaments')}>
              Créer un tournoi
            </Button>
          </div>
        ) : (
          <div>
            {recentTournaments.map((tournament) => (
              <div
                key={tournament.id}
                className="flex items-center justify-between px-6 py-4 border-b border-line-soft hover:bg-bg-alt cursor-pointer transition-colors group"
                onClick={() => navigate(`/tournaments/${tournament.id}`)}
              >
                <div>
                  <p className="font-sans font-bold text-[15px] text-ink group-hover:text-blue transition-colors">
                    {tournament.name}
                  </p>
                  <p className="font-sans text-[12px] text-ink-3 mt-0.5">
                    {formatDate(tournament.date)}
                    {tournament.location && ` · ${tournament.location}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={STATUS_VARIANTS[tournament.status]}>
                    {STATUS_LABELS[tournament.status]}
                  </Badge>
                  <ChevronRight size={16} className="text-ink-3 group-hover:text-blue transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions rapides */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/players')}
          className="bg-bg border-2 border-line hover:border-blue p-5 text-left transition-colors group"
        >
          <Users size={24} className="text-blue mb-3" strokeWidth={1.5} />
          <p className="font-sans font-black uppercase text-[13px] tracking-[0.05em] text-ink group-hover:text-blue transition-colors">
            Gérer les joueurs
          </p>
          <p className="font-sans text-[12px] text-ink-3 mt-1">
            {players.length} joueur{players.length !== 1 ? 's' : ''} enregistré{players.length !== 1 ? 's' : ''}
          </p>
        </button>

        <button
          onClick={() => navigate('/tournaments')}
          className="bg-bg border-2 border-line hover:border-blue p-5 text-left transition-colors group"
        >
          <Trophy size={24} className="text-blue mb-3" strokeWidth={1.5} />
          <p className="font-sans font-black uppercase text-[13px] tracking-[0.05em] text-ink group-hover:text-blue transition-colors">
            Nouveau tournoi
          </p>
          <p className="font-sans text-[12px] text-ink-3 mt-1">
            Organiser un tournoi en 4 étapes simples
          </p>
        </button>
      </div>
    </div>
  )
}
