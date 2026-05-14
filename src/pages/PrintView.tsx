import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTournamentsStore } from '@/store/tournamentsStore'
import { usePlayersStore } from '@/store/playersStore'
import { useRulesStore } from '@/store/rulesStore'
import { playerDisplayName, CATEGORY_LABELS } from '@/types/domain'
import { computeStandings } from '@/engine/standings'
import { Printer, ArrowLeft } from 'lucide-react'
import type { Match, MatchScore, ScoringRule } from '@/types/domain'

// ─── Page d'impression ────────────────────────────────────────────────────────

export function PrintView() {
  const { id: tournamentIdStr } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const tournamentId = Number(tournamentIdStr)

  const { tournaments } = useTournamentsStore()
  const { players } = usePlayersStore()
  const { rules } = useRulesStore()

  const [matches, setMatches] = useState<Match[]>([])
  const [allScores, setAllScores] = useState<Map<number, MatchScore[]>>(new Map())
  const [tournamentPlayerIds, setTournamentPlayerIds] = useState<number[]>([])

  const tournament = tournaments.find((t) => t.id === tournamentId)
  const rule = rules.find((r) => r.id === tournament?.scoringRuleId)

  // Charge les matchs et les scores
  useEffect(() => {
    const load = async () => {
      const [matchList, tPlayers] = await Promise.all([
        window.db.getMatches(tournamentId),
        window.db.getTournamentPlayers(tournamentId),
      ])
      setMatches(matchList)
      setTournamentPlayerIds(tPlayers.map((tp) => tp.playerId))

      const scoreMap = new Map<number, MatchScore[]>()
      await Promise.all(
        matchList.map(async (m) => {
          const scores = await window.db.getMatchScores(m.id)
          scoreMap.set(m.id, scores)
        })
      )
      setAllScores(scoreMap)
    }
    void load()
  }, [tournamentId])

  // Noms des joueurs pour les matchs
  const allPlayerNames = useMemo(() => {
    return new Map(players.map((p) => [p.id, playerDisplayName(p)]))
  }, [players])

  // Classement
  const standings = useMemo(() => {
    if (!rule || matches.length === 0 || tournamentPlayerIds.length === 0) return []
    const playerNames = new Map(players.map((p) => [p.id, playerDisplayName(p)]))
    return computeStandings(tournamentPlayerIds, playerNames, matches, allScores, rule as ScoringRule)
  }, [matches, allScores, tournamentPlayerIds, players, rule])

  // Résoud les noms d'une équipe (simple ou double)
  const resolveTeam = (teamStr: string | undefined): string => {
    if (!teamStr) return '—'
    return teamStr
      .split(',')
      .map((s) => allPlayerNames.get(parseInt(s.trim(), 10)) ?? '?')
      .join(' / ')
  }

  // Score lisible : "21-15, 21-18" ou "—"
  const formatScore = (matchId: number): string => {
    const scores = allScores.get(matchId) ?? []
    if (scores.length === 0) return '—'
    return scores.map((s) => `${s.scoreA}-${s.scoreB}`).join(', ')
  }

  const statusLabel: Record<string, string> = {
    pending: 'À jouer',
    in_progress: 'En cours',
    completed: 'Terminé',
    walkover: 'WO',
    postponed: 'Reporté',
  }

  // Grouper les matchs par round / catégorie
  const matchesByRound = useMemo(() => {
    const map = new Map<number, Match[]>()
    for (const m of matches) {
      const r = m.round ?? 1
      if (!map.has(r)) map.set(r, [])
      map.get(r)!.push(m)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b)
  }, [matches])

  if (!tournament) {
    return (
      <div className="p-8 font-sans text-ink">
        <p className="text-ink-3">Tournoi introuvable.</p>
      </div>
    )
  }

  return (
    <div className="bg-bg min-h-full">

      {/* ── Barre d'actions (masquée à l'impression) ────────────────────── */}
      <div className="print:hidden flex items-center justify-between px-8 py-4 bg-ink border-b-2 border-line sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/tournaments/${tournamentId}`)}
            className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-[0.08em]
              text-line-soft hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            Retour
          </button>
          <span className="text-white/20">|</span>
          <span className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-white/60">
            Impression — {tournament.name}
          </span>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-green-fluo text-ink font-black
            text-[12px] uppercase tracking-[0.05em] hover:brightness-110 transition-colors min-h-[44px]"
        >
          <Printer size={14} />
          Imprimer
        </button>
      </div>

      {/* ── Contenu imprimable ───────────────────────────────────────────── */}
      <div className="max-w-[900px] mx-auto px-8 py-10 print:max-w-none print:px-6 print:py-4">

        {/* En-tête du document */}
        <div className="mb-8 pb-6 border-b-2 border-line">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-black uppercase text-[36px] tracking-[-0.03em] leading-none text-ink print:text-[28px]">
                {tournament.name}
              </h1>
              <div className="flex items-center gap-4 mt-2">
                <span className="font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-ink-3">
                  {new Date(tournament.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                {tournament.location && (
                  <>
                    <span className="text-ink-3">·</span>
                    <span className="font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-ink-3">
                      {tournament.location}
                    </span>
                  </>
                )}
                {rule && (
                  <>
                    <span className="text-ink-3">·</span>
                    <span className="font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-ink-3">
                      {rule.name}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">
                Imprimé le
              </div>
              <div className="font-mono text-[12px] font-bold text-ink">
                {new Date().toLocaleDateString('fr-FR')}
              </div>
            </div>
          </div>
        </div>

        {/* ── Classement ──────────────────────────────────────────────────── */}
        {standings.length > 0 && (
          <section className="mb-10 print:break-inside-avoid-page">
            <h2 className="font-black uppercase text-[18px] tracking-[-0.02em] text-ink mb-4 pb-2 border-b border-line-soft">
              Classement final
            </h2>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-ink">
                  {['#', 'Joueur / Équipe', 'V', 'D', 'Sets', 'Pts'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-green-fluo">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {standings.map((entry, i) => (
                  <tr key={entry.playerId} className={i % 2 === 0 ? 'bg-bg' : 'bg-bg-alt'}>
                    <td className={`px-3 py-2 font-mono text-[12px] font-bold ${i === 0 ? 'text-blue' : 'text-ink-3'}`}>
                      {i + 1}
                    </td>
                    <td className="px-3 py-2 font-sans font-bold text-[13px] text-ink">
                      {entry.playerName}
                      {i === 0 && (
                        <span className="ml-2 text-[10px] font-mono font-bold uppercase tracking-[0.06em] text-green">
                          ★ Vainqueur
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[13px] text-green font-bold">{entry.matchesWon}</td>
                    <td className="px-3 py-2 font-mono text-[13px] text-ink-3">{entry.matchesLost}</td>
                    <td className="px-3 py-2 font-mono text-[12px] text-ink-3">
                      {entry.setsWon}/{entry.setsWon + entry.setsLost}
                    </td>
                    <td className={`px-3 py-2 font-mono font-bold text-[13px] ${i === 0 ? 'text-blue' : 'text-ink'}`}>
                      {entry.rankPoints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ── Liste des matchs ─────────────────────────────────────────────── */}
        <section>
          <h2 className="font-black uppercase text-[18px] tracking-[-0.02em] text-ink mb-4 pb-2 border-b border-line-soft">
            Résultats des matchs
          </h2>

          {matchesByRound.map(([round, roundMatches]) => (
            <div key={round} className="mb-6 print:break-inside-avoid-page">
              <h3 className="font-mono font-bold text-[11px] uppercase tracking-[0.08em] text-ink-3 mb-2">
                Tour {round}
              </h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-bg-strong">
                    {['#', 'Cat.', 'Équipe A', 'Score', 'Équipe B', 'État'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roundMatches.map((m, i) => {
                    const scores = allScores.get(m.id) ?? []
                    const isComplete = m.status === 'completed' || m.status === 'walkover'
                    // Détermine le vainqueur
                    let winnerSide: 'a' | 'b' | null = null
                    if (m.status === 'completed' && scores.length > 0) {
                      const setsA = scores.filter((s) => s.scoreA > s.scoreB).length
                      const setsB = scores.filter((s) => s.scoreB > s.scoreA).length
                      winnerSide = setsA > setsB ? 'a' : setsB > setsA ? 'b' : null
                    }
                    return (
                      <tr key={m.id} className={i % 2 === 0 ? 'bg-bg' : 'bg-bg-alt'}>
                        <td className="px-3 py-2 font-mono text-[11px] text-ink-3">
                          {String(m.id).padStart(2, '0')}
                        </td>
                        <td className="px-3 py-2">
                          {m.category && (
                            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">
                              {m.category in CATEGORY_LABELS ? CATEGORY_LABELS[m.category as keyof typeof CATEGORY_LABELS] : m.category}
                            </span>
                          )}
                        </td>
                        <td className={`px-3 py-2 font-sans text-[13px] ${winnerSide === 'a' ? 'font-black text-blue' : 'font-normal text-ink'}`}>
                          {resolveTeam(m.teamA)}
                        </td>
                        <td className="px-3 py-2 font-mono text-[13px] font-bold text-ink text-center whitespace-nowrap">
                          {isComplete ? formatScore(m.id) : '—'}
                        </td>
                        <td className={`px-3 py-2 font-sans text-[13px] ${winnerSide === 'b' ? 'font-black text-blue' : 'font-normal text-ink'}`}>
                          {resolveTeam(m.teamB)}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.06em]
                            ${m.status === 'completed' ? 'text-green' : m.status === 'in_progress' ? 'text-warn' : 'text-ink-3'}`}>
                            {statusLabel[m.status] ?? m.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}

          {matches.length === 0 && (
            <p className="font-sans text-[14px] text-ink-3">Aucun match généré pour ce tournoi.</p>
          )}
        </section>

        {/* ── Liste des participants ─────────────────────────────────────── */}
        {tournamentPlayerIds.length > 0 && (
          <section className="mt-10 print:break-inside-avoid-page">
            <h2 className="font-black uppercase text-[18px] tracking-[-0.02em] text-ink mb-4 pb-2 border-b border-line-soft">
              Participants ({tournamentPlayerIds.length})
            </h2>
            <div className="grid grid-cols-3 gap-x-6 gap-y-1.5 print:grid-cols-4">
              {tournamentPlayerIds.map((pid) => {
                const p = players.find((x) => x.id === pid)
                return p ? (
                  <div key={pid} className="flex items-center gap-2 py-1.5 border-b border-line-soft">
                    <span className="font-sans text-[13px] text-ink">{playerDisplayName(p)}</span>
                    {p.level && (
                      <span className="font-mono text-[10px] uppercase text-ink-3 shrink-0">{p.level}</span>
                    )}
                  </div>
                ) : null
              })}
            </div>
          </section>
        )}

        {/* Pied de page imprimé */}
        <div className="hidden print:block mt-12 pt-4 border-t border-line-soft text-center">
          <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-3">
            ShuttleCup · {tournament.name} · Imprimé le {new Date().toLocaleDateString('fr-FR')}
          </p>
        </div>

      </div>
    </div>
  )
}
