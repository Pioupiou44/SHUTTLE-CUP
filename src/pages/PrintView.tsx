import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTournamentsStore } from '@/store/tournamentsStore'
import { usePlayersStore } from '@/store/playersStore'
import { useRulesStore } from '@/store/rulesStore'
import { playerDisplayName, CATEGORY_LABELS } from '@/types/domain'
import { computeStandings } from '@/engine/standings'
import { Printer, ArrowLeft } from 'lucide-react'
import type { Match, MatchScore, ScoringRule, TournamentFormat } from '@/types/domain'

// ─── Labels courts des formats ────────────────────────────────────────────────
const FORMAT_SHORT: Record<TournamentFormat, string> = {
  'round-robin':        'Round Robin',
  'knockout':           'Tableau KO',
  'double-elimination': 'Double élimination',
  'pool+knockout':      'Poules + KO',
  'americano':          'Américano',
  'swiss':              'Suisse',
  'king-of-court':      'King of court',
}

// ─── Composant pied de page ───────────────────────────────────────────────────
function PageFooter({ tournamentName, page }: { tournamentName: string; page?: number }) {
  return (
    <div className="mt-8 pt-3 border-t border-line-soft flex items-center justify-between">
      <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-3">
        ShuttleCup · {tournamentName}
      </span>
      {page != null && (
        <span className="font-mono text-[9px] text-ink-3">Page {page}</span>
      )}
    </div>
  )
}

// ─── Mini en-tête de page (pages 2+) ─────────────────────────────────────────
function PageHeader({ tournamentName, dateStr }: { tournamentName: string; dateStr: string }) {
  return (
    <div className="flex items-center justify-between pb-3 mb-6 border-b-2 border-line">
      <div className="flex items-center gap-3">
        <img src="/fonts/logo.png" alt="ShuttleCup" className="w-5 h-5 object-contain" />
        <span className="font-black uppercase text-[12px] tracking-[0.06em] text-ink leading-none">
          SHUTTLE/CUP
        </span>
        <span className="text-ink-3 select-none">·</span>
        <span className="font-mono font-bold text-[11px] uppercase tracking-[0.06em] text-ink-2">
          {tournamentName}
        </span>
      </div>
      <span className="font-mono text-[10px] text-ink-3">{dateStr}</span>
    </div>
  )
}

// ─── Page d'impression ────────────────────────────────────────────────────────
export function PrintView() {
  const { id: tournamentIdStr } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const tournamentId = Number(tournamentIdStr)

  const { tournaments, fetchTournaments } = useTournamentsStore()
  const { players, fetchPlayers } = usePlayersStore()
  const { rules, fetchRules } = useRulesStore()

  const [matches, setMatches] = useState<Match[]>([])
  const [allScores, setAllScores] = useState<Map<number, MatchScore[]>>(new Map())
  const [tournamentPlayerIds, setTournamentPlayerIds] = useState<number[]>([])
  const [loaded, setLoaded] = useState(false)

  // Charge les stores + données locales au montage
  useEffect(() => {
    const load = async () => {
      // Assure que les stores sont peuplés (cas nouvelle fenêtre)
      await Promise.all([fetchTournaments(), fetchPlayers(), fetchRules()])

      const [matchList, tPlayers] = await Promise.all([
        window.db.getMatches(tournamentId),
        window.db.getTournamentPlayers(tournamentId),
      ])
      setMatches(matchList)
      setTournamentPlayerIds(tPlayers.map((tp) => tp.playerId))

      // Charge tous les scores en une seule requête
      const allScoresArr = await window.db.getAllMatchScores(tournamentId)
      const scoreMap = new Map<number, MatchScore[]>()
      for (const s of allScoresArr) {
        const arr = scoreMap.get(s.matchId) ?? []
        arr.push(s)
        scoreMap.set(s.matchId, arr)
      }
      setAllScores(scoreMap)
      setLoaded(true)
    }
    void load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId])

  const tournament = tournaments.find((t) => t.id === tournamentId)
  const rule = rules.find((r) => r.id === tournament?.scoringRuleId)

  const allPlayerNames = useMemo(
    () => new Map(players.map((p) => [p.id, playerDisplayName(p)])),
    [players]
  )

  // Classement individuel
  const standings = useMemo(() => {
    if (!rule || matches.length === 0 || tournamentPlayerIds.length === 0) return []
    const playerNames = new Map(players.map((p) => [p.id, playerDisplayName(p)]))
    return computeStandings(tournamentPlayerIds, playerNames, matches, allScores, rule as ScoringRule)
  }, [matches, allScores, tournamentPlayerIds, players, rule])

  // Stats calculées
  const stats = useMemo(() => {
    const total = matches.length
    const played = matches.filter((m) => m.status === 'completed' || m.status === 'walkover').length
    let totalSets = 0
    let totalPoints = 0
    allScores.forEach((scores) => {
      totalSets += scores.length
      totalPoints += scores.reduce((acc, s) => acc + s.scoreA + s.scoreB, 0)
    })
    const cats = [...new Set(matches.map((m) => m.category).filter(Boolean))] as string[]
    const completionPct = total > 0 ? Math.round((played / total) * 100) : 0
    return { total, played, totalSets, totalPoints, cats, completionPct }
  }, [matches, allScores])

  // Matchs groupés par tour
  const matchesByRound = useMemo(() => {
    const map = new Map<number, Match[]>()
    for (const m of matches) {
      const r = m.round ?? 1
      if (!map.has(r)) map.set(r, [])
      map.get(r)!.push(m)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b)
  }, [matches])

  // Résoud les noms d'une équipe (simple ou double)
  const resolveTeam = (teamStr: string | undefined): string => {
    if (!teamStr) return '—'
    return teamStr
      .split(',')
      .map((s) => allPlayerNames.get(parseInt(s.trim(), 10)) ?? '?')
      .join(' / ')
  }

  // Formate les scores d'un match
  const formatScore = (matchId: number): string => {
    const scores = allScores.get(matchId) ?? []
    if (scores.length === 0) return '—'
    return scores.map((s) => `${s.scoreA}–${s.scoreB}`).join('  ')
  }

  const dateStr = tournament
    ? new Date(tournament.date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''
  const printDate = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="font-mono text-[12px] text-ink-3 uppercase tracking-[0.08em]">Chargement…</p>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="p-8 font-sans text-ink">
        <p className="text-ink-3">Tournoi introuvable.</p>
      </div>
    )
  }

  // Numéros de pages dynamiques
  let pageNum = 1
  const standingsPageNum = standings.length > 0 ? ++pageNum : null
  const resultsPageNum = matches.length > 0 ? ++pageNum : null
  const participantsPageNum = tournamentPlayerIds.length > 0 ? ++pageNum : null

  return (
    <div className="bg-bg">

      {/* Styles d'impression */}
      <style>{`
        @media print {
          @page { size: A4; margin: 1.5cm 2cm; }
          body  { overflow: visible !important; }
          #root { height: auto !important; overflow: visible !important; }
          main  { overflow: visible !important; height: auto !important; }
        }
      `}</style>

      {/* ── Barre d'actions (masquée à l'impression) ───────────────────── */}
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between px-8 py-4 bg-ink border-b-2 border-line">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/tournaments/${tournamentId}`)}
            className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-[0.08em]
              text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            Retour
          </button>
          <span className="text-white/20 select-none">|</span>
          <span className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-white/50">
            Aperçu avant impression — {tournament.name}
          </span>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2 bg-green-fluo text-ink font-black
            text-[12px] uppercase tracking-[0.05em] hover:brightness-110 transition-all min-h-[44px]"
        >
          <Printer size={14} />
          Imprimer / Exporter PDF
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* PAGE 1 — COUVERTURE                                               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="print:break-after-page px-12 py-10 print:py-0 print:px-0 min-h-screen print:min-h-0 print:h-[257mm] flex flex-col">

        {/* En-tête ShuttleCup */}
        <div className="flex items-start justify-between mb-10 print:mb-8">
          <div className="flex items-center gap-3">
            <img src="/fonts/logo.png" alt="ShuttleCup" className="w-10 h-10 object-contain shrink-0" />
            <div>
              <div className="font-black uppercase text-[18px] tracking-[0.06em] text-ink leading-none">
                SHUTTLE/CUP
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3 mt-1">
                Gestion de tournois de badminton
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-3">Imprimé le</div>
            <div className="font-mono text-[12px] font-bold text-ink mt-0.5">{printDate}</div>
          </div>
        </div>

        {/* Titre du tournoi */}
        <div className="mb-8 print:mb-6 pb-6 print:pb-4 border-b-2 border-line">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-3 mb-3">
            Résultats du tournoi
          </div>
          <h1 className="font-black uppercase text-[56px] print:text-[44px] tracking-[-0.03em] leading-[0.9] text-ink mb-4">
            {tournament.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3">
            <span className="font-mono text-[12px] font-bold uppercase tracking-[0.06em] text-ink-2">
              {dateStr}
            </span>
            {tournament.location && (
              <>
                <span className="text-line-soft select-none">·</span>
                <span className="font-mono text-[12px] font-bold uppercase tracking-[0.06em] text-ink-2">
                  {tournament.location}
                </span>
              </>
            )}
            <span className="text-line-soft select-none">·</span>
            <span className="font-mono text-[12px] font-bold uppercase tracking-[0.06em] text-blue">
              {FORMAT_SHORT[tournament.format] ?? tournament.format}
            </span>
            {rule && (
              <>
                <span className="text-line-soft select-none">·</span>
                <span className="font-mono text-[12px] font-bold uppercase tracking-[0.06em] text-ink-3">
                  {rule.name}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Blocs de stats — 4 colonnes */}
        <div className="grid grid-cols-4 gap-3 mb-6 print:mb-5">
          {/* Joueurs */}
          <div className="border-2 border-line p-4 flex flex-col gap-1">
            <div className="font-black text-[48px] print:text-[38px] leading-none tracking-[-0.03em] text-ink">
              {tournamentPlayerIds.length}
            </div>
            <div className="font-mono font-bold text-[9px] uppercase tracking-[0.08em] text-ink-3">
              Joueurs inscrits
            </div>
          </div>
          {/* Matchs joués */}
          <div className="border-2 border-line p-4 flex flex-col gap-1">
            <div className="font-black text-[48px] print:text-[38px] leading-none tracking-[-0.03em] text-blue">
              {stats.played}
            </div>
            <div className="font-mono font-bold text-[9px] uppercase tracking-[0.08em] text-ink-3">
              Matchs joués
            </div>
            <div className="font-mono text-[9px] text-ink-3">
              sur {stats.total} prévus ({stats.completionPct}%)
            </div>
          </div>
          {/* Sets */}
          <div className="border-2 border-line p-4 flex flex-col gap-1">
            <div className="font-black text-[48px] print:text-[38px] leading-none tracking-[-0.03em] text-ink">
              {stats.totalSets}
            </div>
            <div className="font-mono font-bold text-[9px] uppercase tracking-[0.08em] text-ink-3">
              Sets disputés
            </div>
          </div>
          {/* Points */}
          <div className="border-2 border-line p-4 flex flex-col gap-1">
            <div className="font-black text-[48px] print:text-[38px] leading-none tracking-[-0.03em] text-ink">
              {stats.totalPoints}
            </div>
            <div className="font-mono font-bold text-[9px] uppercase tracking-[0.08em] text-ink-3">
              Points marqués
            </div>
          </div>
        </div>

        {/* Catégories */}
        {stats.cats.length > 0 && (
          <div className="flex items-center gap-3 mb-6 print:mb-5 flex-wrap">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-ink-3 shrink-0">
              Catégories :
            </span>
            {stats.cats.map((cat) => {
              const count = matches.filter(
                (m) => m.category === cat && (m.status === 'completed' || m.status === 'walkover')
              ).length
              return (
                <div key={cat} className="flex items-center gap-2 border border-line-soft px-3 py-1">
                  <span className="font-mono text-[11px] font-bold text-ink">{cat}</span>
                  <span className="font-mono text-[10px] text-ink-2">
                    {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}
                  </span>
                  <span className="font-mono text-[10px] text-ink-3">— {count} matchs</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Podium top 3 */}
        {standings.length >= 1 && (
          <div className="flex-1 flex flex-col justify-end">
            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-3 mb-4">
              Classement final — Podium
            </div>
            {/* 3 colonnes : 2e | 1er | 3e */}
            <div className="flex items-end gap-2">

              {/* 2e place */}
              {standings.length >= 2 ? (
                <div className="flex-1 flex flex-col items-center">
                  <div className="font-sans font-black text-[13px] print:text-[11px] text-ink text-center leading-tight mb-2 w-full line-clamp-2">
                    {standings[1].playerName}
                  </div>
                  <div className="w-full bg-ink flex flex-col items-center justify-center py-5 print:py-3" style={{ minHeight: '76px' }}>
                    <span className="font-mono font-bold text-[9px] uppercase tracking-[0.1em] text-green-fluo">2e</span>
                    <span className="font-mono text-[13px] font-bold text-green-fluo mt-1">
                      {standings[1].matchesWon}V
                    </span>
                    <span className="font-mono text-[10px] text-green-fluo/60">
                      {standings[1].rankPoints} pts
                    </span>
                  </div>
                </div>
              ) : <div className="flex-1" />}

              {/* 1ère place — colonne centrale, plus haute */}
              <div className="flex-1 flex flex-col items-center">
                <div className="font-sans font-black text-[15px] print:text-[13px] text-blue text-center leading-tight mb-2 w-full line-clamp-2">
                  {standings[0].playerName}
                </div>
                <div
                  className="w-full bg-blue flex flex-col items-center justify-center py-5 print:py-4"
                  style={{ minHeight: '110px' }}
                >
                  <span className="font-mono font-bold text-[9px] uppercase tracking-[0.1em] text-white/70">1er · Vainqueur</span>
                  <span className="font-mono text-[20px] print:text-[16px] font-bold text-white mt-1">
                    {standings[0].matchesWon}V
                  </span>
                  <span className="font-mono text-[11px] text-white/70">
                    {standings[0].rankPoints} pts
                  </span>
                </div>
              </div>

              {/* 3e place */}
              {standings.length >= 3 ? (
                <div className="flex-1 flex flex-col items-center">
                  <div className="font-sans font-black text-[13px] print:text-[11px] text-ink text-center leading-tight mb-2 w-full line-clamp-2">
                    {standings[2].playerName}
                  </div>
                  <div
                    className="w-full bg-bg-strong border-2 border-line flex flex-col items-center justify-center py-4 print:py-2"
                    style={{ minHeight: '58px' }}
                  >
                    <span className="font-mono font-bold text-[9px] uppercase tracking-[0.1em] text-ink-3">3e</span>
                    <span className="font-mono text-[13px] font-bold text-ink-2 mt-1">
                      {standings[2].matchesWon}V
                    </span>
                    <span className="font-mono text-[10px] text-ink-3">{standings[2].rankPoints} pts</span>
                  </div>
                </div>
              ) : <div className="flex-1" />}

            </div>
          </div>
        )}

        {/* Pied de page couverture */}
        <PageFooter tournamentName={tournament.name} page={1} />
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* PAGE 2 — CLASSEMENT FINAL                                         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {standings.length > 0 && (
        <div className="print:break-before-page print:break-after-page px-12 py-10 print:py-0 print:px-0">
          <PageHeader tournamentName={tournament.name} dateStr={dateStr} />

          <h2 className="font-black uppercase text-[26px] print:text-[22px] tracking-[-0.02em] text-ink mb-6">
            Classement Final
          </h2>

          <table className="w-full border-collapse border-2 border-line">
            <thead>
              <tr className="bg-ink">
                {['#', 'Joueur', 'Club', 'V', 'D', 'Sets', 'Pts marqués', 'Points'].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-[9px] font-mono font-bold uppercase tracking-[0.08em] text-green-fluo first:pl-4"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standings.map((entry, i) => {
                const p = players.find((pl) => pl.id === entry.playerId)
                const isFirst = i === 0
                return (
                  <tr
                    key={entry.playerId}
                    className={`border-b border-line-soft print:break-inside-avoid ${i % 2 === 0 ? 'bg-bg' : 'bg-bg-alt'}`}
                  >
                    <td className={`pl-4 pr-3 py-2 font-mono text-[12px] font-bold ${isFirst ? 'text-blue' : 'text-ink-3'}`}>
                      {i + 1}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`font-sans font-bold text-[13px] ${isFirst ? 'text-blue' : 'text-ink'}`}>
                        {entry.playerName}
                      </span>
                      {isFirst && (
                        <span className="ml-2 font-mono text-[8px] font-bold uppercase tracking-[0.06em] text-green bg-bg-strong px-1.5 py-0.5">
                          ★ Vainqueur
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-ink-3">{p?.club || '—'}</td>
                    <td className="px-3 py-2 font-mono text-[13px] text-green font-bold">{entry.matchesWon}</td>
                    <td className="px-3 py-2 font-mono text-[13px] text-ink-3">{entry.matchesLost}</td>
                    <td className="px-3 py-2 font-mono text-[12px] text-ink-3">
                      {entry.setsWon} / {entry.setsWon + entry.setsLost}
                    </td>
                    <td className="px-3 py-2 font-mono text-[12px] text-ink-3">
                      {entry.pointsWon} / {entry.pointsWon + entry.pointsLost}
                    </td>
                    <td className={`px-3 py-2 font-mono font-bold text-[13px] ${isFirst ? 'text-blue' : 'text-ink'}`}>
                      {entry.rankPoints}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Légende */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
            {[
              'V = Victoires',
              'D = Défaites',
              'Sets = gagnés / joués',
              'Pts marqués = marqués / encaissés',
              'Points = 2 pts victoire · 1 pt défaite',
            ].map((l) => (
              <span key={l} className="font-mono text-[8px] text-ink-3 uppercase tracking-[0.06em]">{l}</span>
            ))}
          </div>

          <PageFooter tournamentName={tournament.name} page={standingsPageNum ?? undefined} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* PAGE 3+ — RÉSULTATS DES MATCHS                                    */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {matches.length > 0 && (
        <div className="print:break-before-page px-12 py-10 print:py-0 print:px-0">
          <PageHeader tournamentName={tournament.name} dateStr={dateStr} />

          <h2 className="font-black uppercase text-[26px] print:text-[22px] tracking-[-0.02em] text-ink mb-6">
            Résultats des Matchs
          </h2>

          {matchesByRound.map(([round, roundMatches]) => {
            const hasCats = roundMatches.some((m) => m.category)
            const playedCount = roundMatches.filter(
              (m) => m.status === 'completed' || m.status === 'walkover'
            ).length
            return (
              <div key={round} className="mb-8 print:break-inside-avoid">

                {/* Titre du tour */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-ink px-3 py-1 shrink-0">
                    <span className="font-mono font-bold text-[9px] uppercase tracking-[0.08em] text-green-fluo">
                      Tour {round}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-line-soft" />
                  <span className="font-mono text-[9px] text-ink-3 shrink-0">
                    {playedCount} / {roundMatches.length} joués
                  </span>
                </div>

                <table className="w-full border-collapse border-2 border-line">
                  <thead>
                    <tr className="bg-bg-strong">
                      <th className="px-3 py-2 text-left text-[9px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 w-8">#</th>
                      {hasCats && (
                        <th className="px-3 py-2 text-left text-[9px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 w-10">Cat.</th>
                      )}
                      <th className="px-3 py-2 text-left text-[9px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3">Équipe A</th>
                      <th className="px-3 py-2 text-center text-[9px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 w-36">Score</th>
                      <th className="px-3 py-2 text-left text-[9px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3">Équipe B</th>
                      <th className="px-3 py-2 text-right text-[9px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 w-20">État</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roundMatches.map((m, i) => {
                      const scores = allScores.get(m.id) ?? []
                      const isComplete = m.status === 'completed' || m.status === 'walkover'
                      let winnerSide: 'A' | 'B' | null = m.winnerSide ?? null
                      if (!winnerSide && m.status === 'completed' && scores.length > 0) {
                        const sA = scores.filter((s) => s.scoreA > s.scoreB).length
                        const sB = scores.filter((s) => s.scoreB > s.scoreA).length
                        winnerSide = sA > sB ? 'A' : sB > sA ? 'B' : null
                      }
                      return (
                        <tr
                          key={m.id}
                          className={`border-b border-line-soft ${i % 2 === 0 ? 'bg-bg' : 'bg-bg-alt'}`}
                        >
                          <td className="px-3 py-2 font-mono text-[10px] text-ink-3">
                            {String(m.id).padStart(3, '0')}
                          </td>
                          {hasCats && (
                            <td className="px-3 py-2 font-mono text-[10px] font-bold text-ink-2">
                              {m.category ?? '—'}
                            </td>
                          )}
                          <td className={`px-3 py-2 font-sans text-[12px] ${winnerSide === 'A' ? 'font-black text-blue' : 'text-ink'}`}>
                            {resolveTeam(m.teamA)}
                          </td>
                          <td className="px-3 py-2 font-mono text-[12px] font-bold text-ink text-center whitespace-nowrap">
                            {isComplete ? formatScore(m.id) : m.status === 'in_progress' ? '…' : '—'}
                          </td>
                          <td className={`px-3 py-2 font-sans text-[12px] ${winnerSide === 'B' ? 'font-black text-blue' : 'text-ink'}`}>
                            {resolveTeam(m.teamB)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span
                              className={`font-mono text-[9px] font-bold uppercase tracking-[0.06em]
                                ${m.status === 'completed' ? 'text-green'
                                  : m.status === 'walkover' ? 'text-warn'
                                  : m.status === 'in_progress' ? 'text-warn'
                                  : 'text-ink-3'}`}
                            >
                              {m.status === 'completed' ? '✓ Terminé'
                                : m.status === 'walkover' ? 'WO'
                                : m.status === 'in_progress' ? 'En cours'
                                : 'À jouer'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}

          <PageFooter tournamentName={tournament.name} page={resultsPageNum ?? undefined} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* PAGE FINALE — LISTE DES PARTICIPANTS                              */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tournamentPlayerIds.length > 0 && (
        <div className="print:break-before-page px-12 py-10 print:py-0 print:px-0">
          <PageHeader tournamentName={tournament.name} dateStr={dateStr} />

          <h2 className="font-black uppercase text-[26px] print:text-[22px] tracking-[-0.02em] text-ink mb-6">
            Participants — {tournamentPlayerIds.length} joueurs
          </h2>

          <div className="grid grid-cols-3 print:grid-cols-4 gap-x-6">
            {tournamentPlayerIds
              .map((pid) => players.find((x) => x.id === pid))
              .filter((p): p is NonNullable<typeof p> => p != null)
              .sort((a, b) => playerDisplayName(a).localeCompare(playerDisplayName(b)))
              .map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 py-2 border-b border-line-soft"
                >
                  <div
                    className="w-1.5 h-4 shrink-0"
                    style={{
                      backgroundColor:
                        p.gender === 'M' ? '#0047FF' : p.gender === 'F' ? '#00C24A' : '#8a8a82',
                    }}
                  />
                  <span className="font-sans text-[12px] font-bold text-ink truncate flex-1">
                    {playerDisplayName(p)}
                  </span>
                  {p.level && (
                    <span className="font-mono text-[9px] uppercase text-ink-3 shrink-0">{p.level}</span>
                  )}
                </div>
              ))}
          </div>

          <div className="mt-5 flex items-center gap-5">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-3 bg-blue" />
              <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-3">Homme</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-3 bg-green" />
              <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-3">Femme</span>
            </div>
          </div>

          <PageFooter tournamentName={tournament.name} page={participantsPageNum ?? undefined} />
        </div>
      )}

    </div>
  )
}
