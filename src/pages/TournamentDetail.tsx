import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTournamentsStore } from '@/store/tournamentsStore'
import { usePlayersStore } from '@/store/playersStore'
import { useRulesStore } from '@/store/rulesStore'
import { Button, Badge } from '@/components/ui'
import { Play, ChevronLeft, Users, BarChart3, List, GitBranch, CheckCircle, Archive } from 'lucide-react'
import { playerDisplayName, CATEGORY_LABELS } from '@/types/domain'
import { generateRoundRobin } from '@/engine/generators/roundRobin'
import { generateSingleElim } from '@/engine/generators/singleElim'
import { generateAmericano } from '@/engine/generators/americano'
import { generatePoolPlusKnockout } from '@/engine/generators/poolPlusKnockout'
import { computeStandings } from '@/engine/standings'
import type { Match, MatchScore, MatchCategory, ScoringRule } from '@/types/domain'

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'planning' | 'standings' | 'bracket' | 'players'

const MATCH_STATUS_LABELS: Record<string, string> = {
  pending:     'À jouer',
  in_progress: 'En cours',
  completed:   'Terminé',
  walkover:    'Forfait',
  postponed:   'Reporté',
}

const MATCH_STATUS_BADGE: Record<string, 'default' | 'active' | 'success' | 'warning'> = {
  pending:     'default',
  in_progress: 'active',
  completed:   'success',
  walkover:    'warning',
  postponed:   'warning',
}

// ─── Utilitaire ───────────────────────────────────────────────────────────────

function resolveTeam(teamStr: string | undefined, playerNames: Map<number, string>): string {
  if (!teamStr || teamStr === 'BYE') return teamStr === 'BYE' ? 'BYE' : '?'
  const ids = teamStr.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
  if (ids.length === 0) return '?'
  return ids.map((id) => playerNames.get(id) ?? `Joueur ${id}`).join(' / ')
}

// ─── Onglet Planning ──────────────────────────────────────────────────────────

function PlanningTab({
  matches,
  tournamentId,
  hasCats,
  allPlayerNames,
  navigate,
}: {
  matches: Match[]
  tournamentId: number
  hasCats: boolean
  allPlayerNames: Map<number, string>
  navigate: ReturnType<typeof useNavigate>
}) {
  const [filterCat, setFilterCat] = useState<MatchCategory | 'all'>('all')

  const categories = useMemo(() => {
    const cats = new Set(matches.map((m) => m.category).filter(Boolean) as MatchCategory[])
    return Array.from(cats)
  }, [matches])

  const filtered = filterCat === 'all' ? matches : matches.filter((m) => m.category === filterCat)

  const byRound = useMemo(() => {
    const map = new Map<number, Match[]>()
    for (const m of filtered) {
      const r = m.round ?? 0
      if (!map.has(r)) map.set(r, [])
      map.get(r)!.push(m)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b)
  }, [filtered])

  return (
    <div className="flex flex-col gap-6">
      {hasCats && categories.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {(['all', ...categories] as const).map((c) => (
            <button key={c} onClick={() => setFilterCat(c)}
              className={`px-3 py-1.5 min-h-[36px] font-mono font-bold uppercase text-[11px] tracking-[0.06em]
                border-2 transition-colors
                ${filterCat === c ? 'bg-ink text-green-fluo border-ink' : 'bg-bg text-ink border-line hover:bg-bg-strong'}`}>
              {c === 'all' ? 'Tous' : `${c} — ${CATEGORY_LABELS[c]}`}
            </button>
          ))}
        </div>
      )}

      {byRound.length === 0 ? (
        <div className="py-16 text-center border-2 border-line-soft border-dashed">
          <p className="font-sans font-black uppercase text-[18px] text-ink-3 mb-2">Aucun match planifié</p>
          <p className="font-sans text-[14px] text-ink-3">Cliquez sur « Lancer le tournoi » pour générer les matchs.</p>
        </div>
      ) : (
        byRound.map(([round, roundMatches]) => (
          <div key={round}>
            <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-2">
              {round >= 100 ? `Knockout — Tour ${round - 99}` : `Ronde ${round}`}
            </p>
            <div className="flex flex-col border-2 border-line">
              <div className={`grid ${hasCats ? 'grid-cols-[1fr_1fr_80px_130px_110px]' : 'grid-cols-[1fr_1fr_80px_110px]'} bg-ink px-4 py-2`}>
                {['Équipe A', 'Équipe B', 'Terrain', ...(hasCats ? ['Discipline'] : []), 'Statut'].map((h) => (
                  <span key={h} className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-green-fluo">{h}</span>
                ))}
              </div>
              {roundMatches.map((m, i) => (
                <div key={m.id}
                  className={`grid ${hasCats ? 'grid-cols-[1fr_1fr_80px_130px_110px]' : 'grid-cols-[1fr_1fr_80px_110px]'} items-center px-4 py-3
                    border-b border-line-soft hover:bg-bg-strong transition-colors cursor-pointer
                    ${i % 2 === 0 ? 'bg-bg' : 'bg-bg-alt'}`}
                  onClick={() => navigate(`/tournaments/${tournamentId}/match/${m.id}`)}
                >
                  <span className="font-sans font-bold text-[14px] text-ink">
                    {resolveTeam(m.teamA, allPlayerNames)}
                  </span>
                  <span className="font-sans font-bold text-[14px] text-ink">
                    {resolveTeam(m.teamB, allPlayerNames)}
                  </span>
                  <span className="text-[11px] font-mono text-ink-3">
                    {m.courtNumber ? `T${m.courtNumber}` : '—'}
                  </span>
                  {hasCats && (
                    <span className="text-[11px] font-mono font-bold text-ink">
                      {m.category ?? '—'}
                    </span>
                  )}
                  <Badge variant={MATCH_STATUS_BADGE[m.status] ?? 'default'}>
                    {MATCH_STATUS_LABELS[m.status] ?? m.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ─── Onglet Classement ────────────────────────────────────────────────────────

function StandingsTab({
  tournamentPlayers,
  matches,
  allScores,
  rule,
  players,
}: {
  tournamentPlayers: number[]
  matches: Match[]
  allScores: Map<number, MatchScore[]>
  rule: ScoringRule | undefined
  players: ReturnType<typeof usePlayersStore.getState>['players']
}) {
  const standings = useMemo(() => {
    if (!rule || matches.length === 0 || tournamentPlayers.length === 0) return []
    const playerNames = new Map(players.map((p) => [p.id, playerDisplayName(p)]))
    return computeStandings(tournamentPlayers, playerNames, matches, allScores, rule)
  }, [matches, allScores, tournamentPlayers, players, rule])

  if (standings.length === 0) {
    return (
      <p className="font-sans text-[14px] text-ink-3">
        {matches.length === 0 ? 'Lancez le tournoi pour générer les matchs.' : 'En attente des premiers résultats.'}
      </p>
    )
  }

  return (
    <div className="flex flex-col border-2 border-line">
      <div className="grid grid-cols-[32px_1fr_60px_60px_80px_80px] bg-ink px-4 py-3">
        {['#', 'Joueur', 'V', 'D', 'Sets', 'Pts class.'].map((h) => (
          <span key={h} className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-green-fluo">{h}</span>
        ))}
      </div>
      {standings.map((entry, i) => (
        <div key={entry.playerId}
          className={`grid grid-cols-[32px_1fr_60px_60px_80px_80px] items-center px-4 py-3
            border-b border-line-soft ${i % 2 === 0 ? 'bg-bg' : 'bg-bg-alt'}`}>
          <span className={`text-[11px] font-mono font-bold ${i === 0 ? 'text-blue' : 'text-ink-3'}`}>{i + 1}</span>
          <span className="font-sans font-bold text-[14px] text-ink">{entry.playerName}</span>
          <span className="font-mono text-[14px] text-green font-bold">{entry.matchesWon}</span>
          <span className="font-mono text-[14px] text-ink-3">{entry.matchesLost}</span>
          <span className="font-mono text-[12px] text-ink-3">{entry.setsWon}/{entry.setsWon + entry.setsLost}</span>
          <span className={`font-mono font-bold text-[14px] ${i === 0 ? 'text-blue' : 'text-ink'}`}>{entry.rankPoints}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Onglet Bracket ───────────────────────────────────────────────────────────

function BracketTab({
  matches,
  allPlayerNames,
}: {
  matches: Match[]
  allPlayerNames: Map<number, string>
}) {
  const byRound = useMemo(() => {
    const map = new Map<number, Match[]>()
    for (const m of matches) {
      const r = m.round ?? 1
      if (!map.has(r)) map.set(r, [])
      map.get(r)!.push(m)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b)
  }, [matches])

  if (byRound.length === 0) {
    return <p className="font-sans text-[14px] text-ink-3">Aucun match de bracket disponible.</p>
  }

  const total = byRound.length
  const roundLabels: Record<number, string> = {}
  byRound.forEach(([round], idx) => {
    const remaining = total - idx
    if (remaining === 1) roundLabels[round] = 'Finale'
    else if (remaining === 2) roundLabels[round] = 'Demi-finales'
    else if (remaining === 3) roundLabels[round] = 'Quarts de finale'
    else roundLabels[round] = `Tour ${round >= 100 ? round - 99 : round}`
  })

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-0 min-w-max">
        {byRound.map(([round, roundMatches]) => (
          <div key={round} className="flex flex-col min-w-[200px] border-r-2 border-line">
            <div className="px-4 py-2 bg-ink text-green-fluo text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-center">
              {roundLabels[round] ?? `Tour ${round}`}
            </div>
            <div className="flex flex-col justify-around flex-1 py-4 gap-4 px-3">
              {roundMatches.map((m) => {
                const nameA = resolveTeam(m.teamA, allPlayerNames)
                const nameB = resolveTeam(m.teamB, allPlayerNames)
                return (
                  <div key={m.id} className="border-2 border-line">
                    <div className={`px-3 py-2 border-b border-line-soft ${m.status === 'completed' ? 'bg-blue/5' : 'bg-bg'}`}>
                      <span className="font-sans font-bold text-[13px] text-ink block truncate">{nameA}</span>
                    </div>
                    <div className={`px-3 py-2 ${m.status === 'completed' ? 'bg-bg' : 'bg-bg-alt'}`}>
                      <span className="font-sans font-bold text-[13px] text-ink block truncate">{nameB}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {/* Colonne champion */}
        <div className="flex flex-col min-w-[140px]">
          <div className="px-4 py-2 bg-ink text-green-fluo text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-center">
            Champion
          </div>
          <div className="flex-1 flex items-center justify-center px-3 py-4">
            <div className="border-2 border-green bg-green/5 px-4 py-3 text-center w-full">
              <span className="text-[11px] font-mono font-bold text-green uppercase tracking-[0.06em]">
                À déterminer
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function TournamentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const tournamentId = Number(id)

  const { tournaments, updateTournament, fetchTournaments } = useTournamentsStore()
  const { players, fetchPlayers } = usePlayersStore()
  const { rules, fetchRules } = useRulesStore()

  const [tab, setTab] = useState<TabId>('planning')
  const [matches, setMatches] = useState<Match[]>([])
  const [tournamentPlayers, setTournamentPlayers] = useState<number[]>([])
  const [allScores, setAllScores] = useState<Map<number, MatchScore[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [confirming, setConfirming] = useState<'complete' | 'archive' | null>(null)

  const tournament = tournaments.find((t) => t.id === tournamentId)

  useEffect(() => {
    void fetchTournaments()
    void fetchPlayers()
    void fetchRules()
  }, [fetchTournaments, fetchPlayers, fetchRules])

  useEffect(() => {
    if (!tournamentId) return
    const load = async () => {
      setLoading(true)
      try {
        const [tp, m] = await Promise.all([
          window.db.getTournamentPlayers(tournamentId),
          window.db.getMatches(tournamentId),
        ])
        setTournamentPlayers(tp.map((p) => p.playerId))
        setMatches(m)
        const scoresMap = new Map<number, MatchScore[]>()
        await Promise.all(m.map(async (match) => {
          const s = await window.db.getMatchScores(match.id)
          scoresMap.set(match.id, s)
        }))
        setAllScores(scoresMap)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [tournamentId])

  if (!tournament) {
    return (
      <div className="p-8">
        <p className="font-sans text-[14px] text-ink-3">Tournoi introuvable.</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/tournaments')}>
          Retour aux tournois
        </Button>
      </div>
    )
  }

  const rule = rules.find((r) => r.id === tournament.scoringRuleId)
  const participantPlayers = players.filter((p) => tournamentPlayers.includes(p.id))
  const allPlayerNames = new Map(players.map((p) => [p.id, playerDisplayName(p)]))
  const hasCats = tournament.categories.length > 0
  const allMatchesDone = matches.length > 0 && matches.every((m) => m.status === 'completed' || m.status === 'walkover')

  // ─── Génération format-aware ───────────────────────────────────────────────
  const handleGenerate = async () => {
    if (generating || tournamentPlayers.length < 2) return
    setGenerating(true)
    try {
      const categoriesToGenerate: (MatchCategory | undefined)[] =
        tournament.categories.length > 0 ? tournament.categories : [undefined]

      for (const category of categoriesToGenerate) {
        let generated: Omit<Match, 'id' | 'winnerId' | 'comment'>[] = []

        switch (tournament.format) {
          case 'round-robin':
            generated = generateRoundRobin(tournamentPlayers, {
              tournamentId,
              courtCount: tournament.courtCount,
            })
            break

          case 'knockout':
          case 'double-elimination':
            generated = generateSingleElim(tournamentPlayers, tournamentId)
            break

          case 'pool+knockout': {
            const result = generatePoolPlusKnockout(tournamentPlayers, {
              tournamentId,
              courtCount: tournament.courtCount,
              poolCount: 2,
            })
            generated = [...result.poolMatches, ...result.knockoutMatches]
            break
          }

          case 'americano':
            generated = generateAmericano(tournamentPlayers, {
              tournamentId,
              courtCount: tournament.courtCount,
            })
            break

          default:
            generated = generateRoundRobin(tournamentPlayers, {
              tournamentId,
              courtCount: tournament.courtCount,
            })
        }

        for (const m of generated) {
          const hasBothTeams = m.teamA && m.teamB && m.teamA !== 'BYE' && m.teamB !== 'BYE'
          if (hasBothTeams) {
            const playerAId = parseInt(m.teamA!.split(',')[0], 10)
            const playerBId = parseInt(m.teamB!.split(',')[0], 10)
            if (isNaN(playerAId) || isNaN(playerBId)) continue
            await window.db.createMatch({
              tournamentId,
              round: m.round,
              courtNumber: m.courtNumber,
              playerAId,
              playerBId,
              category,
            })
          } else if (tournament.format === 'knockout' || tournament.format === 'double-elimination' || tournament.format === 'pool+knockout') {
            // Sauvegarde le placeholder pour que l'avancement du bracket soit possible
            await window.db.createPlaceholderMatch({
              tournamentId,
              round: m.round,
              category,
            })
          }
        }
      }

      const freshMatches = await window.db.getMatches(tournamentId)
      setMatches(freshMatches)
      await updateTournament(tournamentId, { status: 'active' })
    } finally {
      setGenerating(false)
    }
  }

  const handleComplete = async () => {
    await updateTournament(tournamentId, { status: 'completed' })
    setConfirming(null)
  }

  const handleArchive = async () => {
    await updateTournament(tournamentId, { status: 'archived' })
    setConfirming(null)
  }

  // ─── Onglets ───────────────────────────────────────────────────────────────
  const isElimFormat = ['knockout', 'double-elimination', 'pool+knockout'].includes(tournament.format)

  const TABS: { id: TabId; label: string; icon: React.ElementType; show?: boolean }[] = [
    { id: 'planning',  label: 'Planning',   icon: List },
    { id: 'standings', label: 'Classement', icon: BarChart3 },
    { id: 'bracket',   label: 'Bracket',    icon: GitBranch, show: isElimFormat },
    { id: 'players',   label: 'Joueurs',    icon: Users },
  ]

  const STATUS_LABELS: Record<string, string> = {
    draft: 'Brouillon', active: 'En cours', completed: 'Terminé', archived: 'Archivé',
  }
  const STATUS_BADGE: Record<string, 'default' | 'active' | 'success' | 'info'> = {
    draft: 'default', active: 'active', completed: 'success', archived: 'info',
  }

  return (
    <div className="flex flex-col h-full">
      {/* Bandeau tournoi */}
      <div className="px-8 pt-6 pb-0 border-b-2 border-line bg-bg shrink-0">
        <button
          onClick={() => navigate('/tournaments')}
          className="flex items-center gap-1 text-[12px] font-mono font-bold uppercase tracking-[0.08em]
            text-ink-3 hover:text-ink transition-colors mb-4"
        >
          <ChevronLeft size={12} /> Tournois
        </button>

        <div className="flex items-start justify-between pb-4 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-sans font-black uppercase text-[42px] tracking-[-0.03em] text-ink leading-none">
                {tournament.name}
              </h1>
              <Badge variant={STATUS_BADGE[tournament.status] ?? 'default'}>
                {STATUS_LABELS[tournament.status] ?? tournament.status}
              </Badge>
            </div>
            <p className="font-sans text-[14px] text-ink-3">
              {new Date(tournament.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              {tournament.location ? ` · ${tournament.location}` : ''}
              {' · '}
              {participantPlayers.length} joueur{participantPlayers.length !== 1 ? 's' : ''}
              {rule ? ` · ${rule.name}` : ''}
              {hasCats ? ` · ${tournament.categories.join(' ')}` : ''}
            </p>
          </div>

          {/* Actions selon statut */}
          <div className="flex gap-2 shrink-0 items-center">
            {tournament.status === 'draft' && (
              <Button
                disabled={generating || tournamentPlayers.length < 2}
                onClick={handleGenerate}
              >
                <Play size={13} className="mr-1 inline" />
                {generating ? 'Génération…' : 'Lancer le tournoi'}
              </Button>
            )}
            {tournament.status === 'active' && allMatchesDone && confirming === null && (
              <Button onClick={() => setConfirming('complete')}>
                <CheckCircle size={13} className="mr-1 inline" />
                Clôturer
              </Button>
            )}
            {tournament.status === 'active' && confirming === 'complete' && (
              <div className="flex gap-2 items-center">
                <span className="font-sans text-[13px] text-ink-3">Confirmer la clôture ?</span>
                <Button variant="secondary" size="sm" onClick={() => setConfirming(null)}>Annuler</Button>
                <Button size="sm" onClick={handleComplete}>Confirmer</Button>
              </div>
            )}
            {tournament.status === 'completed' && confirming === null && (
              <Button variant="secondary" onClick={() => setConfirming('archive')}>
                <Archive size={13} className="mr-1 inline" />
                Archiver
              </Button>
            )}
            {tournament.status === 'completed' && confirming === 'archive' && (
              <div className="flex gap-2 items-center">
                <span className="font-sans text-[13px] text-ink-3">Archiver ce tournoi ?</span>
                <Button variant="secondary" size="sm" onClick={() => setConfirming(null)}>Annuler</Button>
                <Button variant="secondary" size="sm" onClick={handleArchive}>Archiver</Button>
              </div>
            )}
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-0 -mb-px">
          {TABS.filter((t) => t.show !== false).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-3 font-sans font-bold uppercase text-[12px]
                tracking-[0.05em] border-b-2 transition-colors
                ${tab === id ? 'text-ink border-blue' : 'text-ink-3 border-transparent hover:text-ink'}`}>
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu onglet */}
      <div className="flex-1 overflow-y-auto scrollbar-light p-8">
        {loading ? (
          <p className="font-sans text-[14px] text-ink-3">Chargement…</p>
        ) : (
          <>
            {tab === 'planning' && (
              <PlanningTab
                matches={matches}
                tournamentId={tournamentId}
                hasCats={hasCats}
                allPlayerNames={allPlayerNames}
                navigate={navigate}
              />
            )}
            {tab === 'standings' && (
              <StandingsTab
                tournamentPlayers={tournamentPlayers}
                matches={matches}
                allScores={allScores}
                rule={rule}
                players={players}
              />
            )}
            {tab === 'bracket' && (
              <BracketTab
                matches={matches}
                allPlayerNames={allPlayerNames}
              />
            )}
            {tab === 'players' && (
              <div className="flex flex-col border-2 border-line">
                <div className="grid grid-cols-[1fr_80px_100px] bg-ink px-4 py-3">
                  {['Joueur', 'Genre', 'Classement'].map((h) => (
                    <span key={h} className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-green-fluo">{h}</span>
                  ))}
                </div>
                {participantPlayers.length === 0 ? (
                  <p className="px-4 py-8 text-center font-sans text-[14px] text-ink-3">
                    Aucun joueur inscrit à ce tournoi
                  </p>
                ) : (
                  participantPlayers.map((p, i) => (
                    <div key={p.id}
                      className={`grid grid-cols-[1fr_80px_100px] items-center px-4 py-3
                        border-b border-line-soft ${i % 2 === 0 ? 'bg-bg' : 'bg-bg-alt'}`}>
                      <span className="font-sans font-bold text-[14px] text-ink">{playerDisplayName(p)}</span>
                      <span className="text-[11px] font-mono text-ink">{p.gender}</span>
                      <span className="text-[11px] font-mono font-bold text-ink">{p.level}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
