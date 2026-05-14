import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTournamentsStore } from '@/store/tournamentsStore'
import { usePlayersStore } from '@/store/playersStore'
import { useRulesStore } from '@/store/rulesStore'
import { Button } from '@/components/ui'
import { playerDisplayName } from '@/types/domain'
import { computeMatchResult, isSetComplete } from '@/engine/scoring'
import type { ScoringRule } from '@/types/domain'

// ─── État local d'un match live ───────────────────────────────────────────────

interface SetScore { a: number; b: number }

function useMatchClock(running: boolean) {
  const [elapsed, setElapsed] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } else {
      if (ref.current) clearInterval(ref.current)
    }
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [running])

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  return { elapsed, label: `${mm}:${ss}`, reset: () => setElapsed(0) }
}

// ─── Score géant ──────────────────────────────────────────────────────────────

function GiantScore({ value, isServer }: { value: number; isServer: boolean }) {
  return (
    <div className="relative">
      <span className="font-mono font-black text-[120px] leading-none tracking-[-0.04em]
        tabular-nums select-none">
        {String(value).padStart(2, '0')}
      </span>
      {isServer && (
        <span className="absolute -top-2 -right-4 w-3 h-3 bg-yellow-400" />
      )}
    </div>
  )
}

// ─── Page principale d'arbitrage ──────────────────────────────────────────────

export function RefereeView() {
  const { id: tournamentIdStr, matchId: matchIdStr } = useParams<{ id: string; matchId: string }>()
  const navigate = useNavigate()
  const tournamentId = Number(tournamentIdStr)
  const matchId = Number(matchIdStr)

  const { tournaments } = useTournamentsStore()
  const { players } = usePlayersStore()
  const { rules } = useRulesStore()

  const [sets, setSets] = useState<SetScore[]>([{ a: 0, b: 0 }])
  const [history, setHistory] = useState<{ setIdx: number; side: 'a' | 'b' }[]>([])
  const [server, setServer] = useState<'a' | 'b'>('a')
  const [paused, setPaused] = useState(false)
  const [matchDone, setMatchDone] = useState(false)

  // Infos match depuis l'IPC (basique — nom équipes)
  const [teamA, setTeamA] = useState<string>('Équipe A')
  const [teamB, setTeamB] = useState<string>('Équipe B')
  const [teamAId, setTeamAId] = useState<number | null>(null)
  const [teamBId, setTeamBId] = useState<number | null>(null)

  const tournament = tournaments.find((t) => t.id === tournamentId)
  const rule = rules.find((r) => r.id === tournament?.scoringRuleId)

  const clock = useMatchClock(!paused && !matchDone)

  // Charge les participants et scores existants du match
  useEffect(() => {
    const load = async () => {
      const [matches, existingScores] = await Promise.all([
        window.db.getMatches(tournamentId),
        window.db.getMatchScores(matchId),
      ])
      const m = matches.find((x) => x.id === matchId)
      if (m) {
        const pa = players.find((p) => p.id === parseInt(m.teamA ?? '', 10))
        const pb = players.find((p) => p.id === parseInt(m.teamB ?? '', 10))
        if (pa) { setTeamA(playerDisplayName(pa)); setTeamAId(pa.id) }
        if (pb) { setTeamB(playerDisplayName(pb)); setTeamBId(pb.id) }
        // Reprend les scores si match déjà commencé
        if (m.status === 'completed') setMatchDone(true)
      }
      if (existingScores.length > 0) {
        setSets(existingScores.map((s) => ({ a: s.scoreA, b: s.scoreB })))
      }
    }
    void load()
  }, [tournamentId, matchId, players])

  const currentSetIndex = sets.length - 1
  const currentSet = sets[currentSetIndex]

  // Calcule résultat courant
  const matchResult = rule
    ? computeMatchResult(sets.map((s, i) => ({
        id: i + 1,
        matchId,
        setNumber: i + 1,
        scoreA: s.a,
        scoreB: s.b,
      })), rule as ScoringRule)
    : null

  const setsWonA = matchResult?.setsA ?? 0
  const setsWonB = matchResult?.setsB ?? 0

  // Vérifie si le set courant est terminé
  const currentSetDone = rule
    ? isSetComplete(currentSet.a, currentSet.b, rule as ScoringRule)
    : false

  const addPoint = (side: 'a' | 'b') => {
    if (matchDone || paused) return
    setHistory((h) => [...h, { setIdx: currentSetIndex, side }])
    setSets((prev) => {
      const next = prev.map((s, i) =>
        i === currentSetIndex ? { ...s, [side]: s[side] + 1 } : s
      )
      const updated = next[currentSetIndex]
      // Sauvegarde le score en BDD
      void window.db.setMatchScore(matchId, currentSetIndex + 1, updated.a, updated.b)
      return next
    })
    // Marque le match "en cours" au premier point
    const isFirstPoint = sets.every((s) => s.a === 0 && s.b === 0)
    if (isFirstPoint) void window.db.updateMatchStatus(matchId, 'in_progress')
    setServer(side)
  }

  const undo = () => {
    if (history.length === 0) return
    const last = history[history.length - 1]
    setSets((prev) => {
      const next = prev.map((s, i) =>
        i === last.setIdx
          ? { ...s, [last.side]: Math.max(0, s[last.side] - 1) }
          : s
      )
      const updated = next[last.setIdx]
      // Sauvegarde le score corrigé en BDD
      void window.db.setMatchScore(matchId, last.setIdx + 1, updated.a, updated.b)
      return next
    })
    setHistory((h) => h.slice(0, -1))
  }

  const validateSet = () => {
    if (!currentSetDone || matchDone) return
    // Vérifie si le match est fini
    if (rule) {
      const updated = [...sets]
      const res = computeMatchResult(updated.map((s, i) => ({
        id: i + 1, matchId, setNumber: i + 1, scoreA: s.a, scoreB: s.b,
      })), rule as ScoringRule)
      if (res.isComplete) {
        setMatchDone(true)
        const winnerPlayerId = res.winner === 'a' ? teamAId : teamBId
        // Sauvegarde en BDD, avance le bracket, puis retour au planning
        void window.db.updateMatchStatus(matchId, 'completed', winnerPlayerId ?? undefined).then(async () => {
          if (winnerPlayerId) {
            await window.db.advanceWinner(tournamentId, matchId, winnerPlayerId)
          }
          navigate(`/tournaments/${tournamentId}`)
        })
        return
      }
    }
    setSets((prev) => [...prev, { a: 0, b: 0 }])
    setServer('a')
    clock.reset()
  }

  // ─── Raccourcis clavier ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      switch (e.key) {
        case 'a':
        case 'A':
        case 'ArrowLeft':
          e.preventDefault()
          addPoint('a')
          break
        case 'b':
        case 'B':
        case 'ArrowRight':
          e.preventDefault()
          addPoint('b')
          break
        case 'z':
        case 'Z':
        case 'Backspace':
          e.preventDefault()
          undo()
          break
        case ' ':
          e.preventDefault()
          setPaused((p) => !p)
          break
        case 'Enter':
          e.preventDefault()
          validateSet()
          break
        case 'Escape':
          navigate(-1)
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [history, sets, currentSetDone, matchDone, paused])

  // ─── Rendu ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-bg text-ink">
      {/* Header LIVE */}
      <div className="flex items-center justify-between px-6 py-3 bg-ink border-b-2 border-line shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-line-soft
            hover:text-white transition-colors"
        >
          ← Retour
        </button>

        <div className="flex items-center gap-3">
          <span className="px-2 py-1 bg-red text-white text-[11px] font-mono font-bold
            uppercase tracking-[0.08em] animate-pulse">
            LIVE
          </span>
          <span className="font-mono font-bold text-[18px] text-white tracking-[0.04em]">
            {clock.label}
          </span>
          {paused && (
            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-warn">
              PAUSE
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-line-soft">
            Set {currentSetIndex + 1}
            {sets.length > 1 ? ` · ${setsWonA}-${setsWonB}` : ''}
          </span>
        </div>
      </div>

      {/* Zone principale : 3 colonnes */}
      <div className="flex flex-1 overflow-hidden">
        {/* Équipe A — bleu */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-blue/5 border-r-2 border-line
          cursor-pointer select-none active:bg-blue/15 transition-colors"
          onClick={() => addPoint('a')}
        >
          <p className="font-sans font-black text-[30px] uppercase tracking-[-0.02em] text-blue text-center px-4">
            {teamA}
          </p>
          <GiantScore value={currentSet.a} isServer={server === 'a'} />
          {sets.length > 1 && (
            <div className="flex gap-1">
              {sets.slice(0, -1).map((s, i) => (
                <span key={i}
                  className={`text-[11px] font-mono font-bold px-2 py-1
                    ${s.a > s.b ? 'bg-blue text-white' : 'bg-bg-strong text-ink-3'}`}>
                  {s.a}
                </span>
              ))}
            </div>
          )}
          <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-blue/60">
            Touche A ou ←
          </p>
        </div>

        {/* Centre — actions */}
        <div className="w-48 flex flex-col items-center justify-between py-8 shrink-0">
          <div className="flex flex-col gap-2 items-center">
            <Button variant="secondary" size="sm" onClick={() => setPaused((p) => !p)}>
              {paused ? '▶ Reprendre' : '⏸ Pause'}
            </Button>
            <p className="text-[10px] font-mono text-ink-3 uppercase">Espace</p>
          </div>

          <div className="flex flex-col gap-1 items-center w-full px-4">
            {/* Scores sets précédents */}
            {sets.slice(0, -1).map((s, i) => (
              <div key={i} className="flex items-center justify-between w-full text-[12px] font-mono text-ink-3">
                <span>Set {i + 1}</span>
                <span className={s.a > s.b ? 'font-bold text-blue' : ''}>{s.a}</span>
                <span>–</span>
                <span className={s.b > s.a ? 'font-bold text-green' : ''}>{s.b}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 items-center w-full px-4">
            <Button variant="secondary" size="sm"
              onClick={undo} disabled={history.length === 0}
              className="w-full justify-center"
            >
              ↩ Annuler
            </Button>
            <p className="text-[10px] font-mono text-ink-3 uppercase">Z ou ←</p>

            {currentSetDone && !matchDone && (
              <>
                <Button size="sm" onClick={validateSet} className="w-full justify-center mt-2">
                  Valider le set
                </Button>
                <p className="text-[10px] font-mono text-ink-3 uppercase">Entrée</p>
              </>
            )}

            {matchDone && (
              <div className="text-center">
                <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-green">
                  Match terminé
                </p>
                <p className="font-sans font-black text-[18px] text-ink mt-1">
                  {setsWonA > setsWonB ? teamA : teamB}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Équipe B — vert */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-green/5 border-l-2 border-line
          cursor-pointer select-none active:bg-green/10 transition-colors"
          onClick={() => addPoint('b')}
        >
          <p className="font-sans font-black text-[30px] uppercase tracking-[-0.02em] text-green text-center px-4">
            {teamB}
          </p>
          <GiantScore value={currentSet.b} isServer={server === 'b'} />
          {sets.length > 1 && (
            <div className="flex gap-1">
              {sets.slice(0, -1).map((s, i) => (
                <span key={i}
                  className={`text-[11px] font-mono font-bold px-2 py-1
                    ${s.b > s.a ? 'bg-green text-white' : 'bg-bg-strong text-ink-3'}`}>
                  {s.b}
                </span>
              ))}
            </div>
          )}
          <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-green/60">
            Touche B ou →
          </p>
        </div>
      </div>

      {/* Pied de page — raccourcis */}
      <div className="flex items-center justify-center gap-6 px-6 py-2 bg-bg-alt border-t-2 border-line shrink-0">
        {[
          { key: 'A/←', action: '+1 Équipe A' },
          { key: 'B/→', action: '+1 Équipe B' },
          { key: 'Z', action: 'Annuler' },
          { key: 'Espace', action: 'Pause' },
          { key: 'Entrée', action: 'Valider set' },
          { key: 'Échap', action: 'Quitter' },
        ].map(({ key, action }) => (
          <div key={key} className="flex items-center gap-1.5">
            <kbd className="bg-ink text-green-fluo font-mono text-[10px] font-bold px-1.5 py-0.5">
              {key}
            </kbd>
            <span className="font-sans text-[11px] text-ink-3">{action}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
