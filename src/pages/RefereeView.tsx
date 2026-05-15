import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTournamentsStore } from '@/store/tournamentsStore'
import { usePlayersStore } from '@/store/playersStore'
import { useRulesStore } from '@/store/rulesStore'
import { playerDisplayName } from '@/types/domain'
import { computeMatchResult, isSetComplete } from '@/engine/scoring'
import type { ScoringRule } from '@/types/domain'

// ─── État local d'un match live ───────────────────────────────────────────────

interface SetScore { a: number; b: number }

// ─── Score géant avec indicateur de service ───────────────────────────────────

function GiantScore({ value, isServer, textClass }: { value: number; isServer: boolean; textClass: string }) {
  return (
    <div className="relative inline-block">
      <span className={`font-mono font-black leading-none tracking-[-0.04em] tabular-nums ${textClass}`}
        style={{ fontSize: 'min(calc((100vw - 256px) * 0.18), 28vh)' }}>
        {String(value).padStart(2, '0')}
      </span>
      {isServer && (
        <span className="absolute -top-2 -right-5 w-3.5 h-3.5 bg-yellow-400" />
      )}
    </div>
  )
}

function useMatchClock(running: boolean, matchId: number) {
  const storageKey = `shuttle-clock-${matchId}`

  // Restaure l'état depuis localStorage au montage
  const [elapsed, setElapsed] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return 0
      const { e, ts } = JSON.parse(raw) as { e: number; ts: number | null }
      // ts = horodatage absolu de l'origine du chrono (null si en pause)
      return ts !== null ? Math.floor((Date.now() - ts) / 1000) : e
    } catch { return 0 }
  })

  // Refs pour accéder aux valeurs courantes dans le cleanup
  const elapsedRef = useRef(elapsed)
  const runningRef = useRef(running)
  elapsedRef.current = elapsed
  runningRef.current = running

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  // Persiste dans localStorage à la destruction du composant
  useEffect(() => {
    return () => {
      try {
        const e = elapsedRef.current
        const isRunning = runningRef.current
        localStorage.setItem(storageKey, JSON.stringify({
          e,
          ts: isRunning ? Date.now() - e * 1000 : null,
        }))
      } catch { /* ignorer les erreurs de stockage */ }
    }
  }, [storageKey])

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  const reset = () => {
    setElapsed(0)
    try { localStorage.removeItem(storageKey) } catch { /* ignorer */ }
  }
  return { elapsed, label: `${mm}:${ss}`, reset }
}

// ─── Page principale d'arbitrage ──────────────────────────────────────────────

export function RefereeView() {
  const { id: tournamentIdStr, matchId: matchIdStr } = useParams<{ id: string; matchId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isStandalone = searchParams.get('standalone') === '1'
  const tournamentId = Number(tournamentIdStr)
  const matchId = Number(matchIdStr)

  const { tournaments, fetchTournaments } = useTournamentsStore()
  const { players, fetchPlayers } = usePlayersStore()
  const { rules, fetchRules } = useRulesStore()

  const historyKey = `shuttle-history-${matchId}`

  const [sets, setSets] = useState<SetScore[]>([{ a: 0, b: 0 }])
  const [history, setHistory] = useState<{ setIdx: number; side: 'a' | 'b' }[]>(() => {
    try {
      const raw = localStorage.getItem(`shuttle-history-${matchId}`)
      return raw ? (JSON.parse(raw) as { setIdx: number; side: 'a' | 'b' }[]) : []
    } catch { return [] }
  })
  const [server, setServer] = useState<'a' | 'b'>('a')
  const [paused, setPaused] = useState(false)
  const [matchDone, setMatchDone] = useState(false)

  // Walkover (abandon) d'un côté
  const handleWalkover = async (side: 'a' | 'b') => {
    if (matchDone) return
    setMatchDone(true)
    const winnerPlayerId = side === 'a' ? teamBId : teamAId // le gagnant est l'autre équipe
    await window.db.updateMatchStatus(matchId, 'walkover', winnerPlayerId ?? undefined)
    if (winnerPlayerId) {
      await window.db.advanceWinner(tournamentId, matchId, winnerPlayerId)
    }
    navigate(`/tournaments/${tournamentId}`)
  }

  // Infos match depuis l'IPC (basique — nom équipes)
  const [teamA, setTeamA] = useState<string>('Équipe A')
  const [teamB, setTeamB] = useState<string>('Équipe B')
  const [teamAId, setTeamAId] = useState<number | null>(null)
  const [teamBId, setTeamBId] = useState<number | null>(null)

  const tournament = tournaments.find((t) => t.id === tournamentId)
  const rule = rules.find((r) => r.id === tournament?.scoringRuleId)

  const clock = useMatchClock(!paused && !matchDone, matchId)

  // Peuple les stores si la fenêtre est ouverte de façon autonome (nouvelle fenêtre Electron)
  useEffect(() => {
    void fetchPlayers()
    void fetchTournaments()
    void fetchRules()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Persiste l'historique du ruban dans localStorage
  useEffect(() => {
    try { localStorage.setItem(historyKey, JSON.stringify(history)) } catch { /* ignorer */ }
  }, [history, historyKey])

  // Charge les participants et scores existants du match
  useEffect(() => {
    const load = async () => {
      const [matches, existingScores] = await Promise.all([
        window.db.getMatches(tournamentId),
        window.db.getMatchScores(matchId),
      ])
      const m = matches.find((x) => x.id === matchId)
      if (m) {
        // Résout tous les IDs d'une équipe (simple ou double)
        const resolveTeamName = (teamStr: string | undefined): string => {
          if (!teamStr) return ''
          const ids = teamStr.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
          const names = ids.map((id) => {
            const p = players.find((p) => p.id === id)
            return p ? playerDisplayName(p) : null
          }).filter(Boolean)
          return names.join(' / ')
        }

        const nameA = resolveTeamName(m.teamA)
        const nameB = resolveTeamName(m.teamB)

        // Pour l'avancement du bracket on garde le 1er joueur de l'équipe
        const firstIdA = m.teamA ? parseInt(m.teamA.split(',')[0], 10) : NaN
        const firstIdB = m.teamB ? parseInt(m.teamB.split(',')[0], 10) : NaN

        if (nameA) { setTeamA(nameA); if (!isNaN(firstIdA)) setTeamAId(firstIdA) }
        if (nameB) { setTeamB(nameB); if (!isNaN(firstIdB)) setTeamBId(firstIdB) }
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
        const winnerPlayerId = res.winner === 'A' ? teamAId : teamBId
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

  // Points du set courant dans l'ordre (pour le ruban)
  const currentSetHistory = history.filter((h) => h.setIdx === currentSetIndex)

  return (
    <div className="flex flex-col h-full select-none overflow-hidden">

      {/* ── Header broadcast ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-ink shrink-0 gap-4">
        <div className="flex items-center gap-4">
          <span className="px-2 py-1 bg-red text-white text-[11px] font-mono font-bold
            uppercase tracking-[0.08em] animate-pulse shrink-0">
            LIVE
          </span>
          <span className="text-[11px] font-mono text-white/60 uppercase tracking-[0.08em]">
            MATCH <span className="text-white font-bold">{String(matchId).padStart(2, '0')}</span>
          </span>
          {tournament?.categories?.[0] && (
            <span className="text-[11px] font-mono text-white/60 uppercase tracking-[0.08em]">
              {tournament.categories[0]}
            </span>
          )}
          {rule && (
            <span className="text-[11px] font-mono text-white/60 uppercase tracking-[0.08em]">
              BO{rule.setsToWin * 2 - 1} · {rule.pointsPerSet}pts
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {paused && (
            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-warn animate-pulse">
              PAUSE
            </span>
          )}
          <span className="font-mono font-bold text-[14px] text-white/60 tracking-[0.06em] uppercase">
            T{currentSetIndex + 1} ·{' '}
            <span className="text-white">{clock.label}</span>
          </span>
          <button
            onClick={() => navigate(`/tournaments/${tournamentId}`)}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 transition-colors
              text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-white border border-white/20"
          >
            PLANNING ↗
          </button>
        </div>
      </div>

      {/* ── Corps principal : 3 colonnes ────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Équipe A — fond bleu solide */}
        <div
          className="flex-1 flex flex-col bg-[#0047FF] cursor-pointer active:brightness-90 transition-all"
          onClick={() => addPoint('a')}
        >
          {/* Nom équipe */}
          <div className="p-5 pt-6">
            <div className="inline-block bg-white/20 px-2 py-0.5 mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.1em] text-white">
                ÉQUIPE A
              </span>
            </div>
            {teamA.split(' / ').map((name, i) => (
              <div key={i}
                className="font-black uppercase tracking-[-0.02em] leading-[0.95] text-white"
                style={{ fontSize: teamA.includes(' / ') ? 'clamp(20px, calc((100vw - 256px) * 0.038), 52px)' : 'clamp(24px, calc((100vw - 256px) * 0.05), 68px)' }}>
                {name}
              </div>
            ))}
          </div>

          {/* Score — ferré à gauche */}
          <div className="flex-1 flex flex-col items-start justify-center gap-4 pl-6">
            <GiantScore value={currentSet.a} isServer={server === 'a'} textClass="text-white" />
            {sets.length > 1 && (
              <div className="flex gap-1.5">
                {sets.slice(0, -1).map((s, i) => (
                  <span key={i}
                    className={`text-[11px] font-mono font-bold px-2 py-1
                      ${s.a > s.b ? 'bg-white text-[#0047FF]' : 'bg-white/20 text-white/60'}`}>
                    {s.a}
                  </span>
                ))}
              </div>
            )}
            <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-white/50">
              Touche A ou ←
            </p>
          </div>

          {/* Bouton +1 point */}
          <button
              className="w-full py-5 bg-white text-[#0047FF] font-black text-[18px]
                uppercase tracking-[0.05em] hover:bg-white/90 active:bg-white/80 transition-colors
                border-t-2 border-white/30 min-h-[64px]"
              onClick={(e) => { e.stopPropagation(); addPoint('a') }}
            >
              [A] + 1 POINT
            </button>
        </div>

        {/* Centre — contrôles */}
        <div className="w-64 flex flex-col bg-bg border-x-2 border-line shrink-0">

          {/* En-tête set courant */}
          <div className="px-4 pt-4 pb-3 border-b border-line-soft text-center">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3">
              SET {currentSetIndex + 1} / {(rule?.setsToWin ?? 2) * 2 - 1}
            </div>
            <div className="font-mono font-black text-[28px] tracking-[-0.02em] text-ink leading-none mt-1">
              {currentSet.a} : {currentSet.b}
            </div>
          </div>

          {/* Scores des sets terminés */}
          <div className="px-4 py-3 border-b border-line-soft flex flex-col gap-1.5 min-h-[40px]">
            {sets.slice(0, -1).map((s, i) => (
              <div key={i} className="flex items-center justify-between text-[12px] font-mono text-ink-3">
                <span>Set {i + 1}</span>
                <span className={s.a > s.b ? 'font-bold text-[#0047FF]' : ''}>{s.a}</span>
                <span>–</span>
                <span className={s.b > s.a ? 'font-bold text-ink' : ''}>{s.b}</span>
              </div>
            ))}
          </div>

          {/* Horloge */}
          <div className="px-4 py-3 border-b border-line-soft text-center">
            <div className="text-[10px] font-mono uppercase tracking-[0.08em] text-ink-3 mb-1">
              HORLOGE
            </div>
            <div className="font-mono font-black text-[20px] text-ink tracking-[0.04em]">
              {clock.label}
            </div>
          </div>

          {/* Boutons actions — hiérarchie ergonomique */}
          <div className="px-3 py-3 flex flex-col gap-2">
            {/* ANNULER — pleine largeur */}
            <button
              disabled={history.length === 0}
              onClick={undo}
              className="w-full py-3 border-2 border-ink-3 text-ink text-[13px] font-mono font-black
                uppercase tracking-[0.06em] bg-bg hover:bg-bg-strong disabled:opacity-30
                disabled:cursor-not-allowed transition-colors"
            >↩ ANNULER</button>
            {/* PAUSE / REPRISE — pleine largeur */}
            <button
              onClick={() => setPaused((p) => !p)}
              className={`w-full py-3 border-2 text-[13px] font-mono font-black uppercase tracking-[0.06em] transition-colors
                ${paused
                  ? 'border-green bg-green text-ink'
                  : 'border-line text-ink bg-bg hover:bg-bg-strong'}`}
            >{paused ? '▶ REPRISE' : '⏸ PAUSE'}</button>
            {/* FORFAITS — 2 colonnes */}
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              <button
                disabled={matchDone}
                onClick={() => handleWalkover('a')}
                className="py-3 border-2 border-ink-3 text-[13px] font-mono font-black uppercase
                  tracking-[0.06em] text-ink bg-bg hover:bg-bg-strong disabled:opacity-30
                  disabled:cursor-not-allowed transition-colors"
              >FORFAIT A</button>
              <button
                disabled={matchDone}
                onClick={() => handleWalkover('b')}
                className="py-3 border-2 border-ink-3 text-[13px] font-mono font-black uppercase
                  tracking-[0.06em] text-ink bg-bg hover:bg-bg-strong disabled:opacity-30
                  disabled:cursor-not-allowed transition-colors"
              >FORFAIT B</button>
            </div>
          </div>

          <div className="flex-1" />

          {/* Match terminé */}
          {matchDone && (
            <div className="px-4 py-3 text-center border-t border-line-soft">
              <div className="text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-green mb-1">
                MATCH TERMINÉ
              </div>
              <div className="font-sans font-black text-[14px] text-ink">
                {setsWonA > setsWonB ? teamA : teamB}
              </div>
            </div>
          )}
        </div>

        {/* Équipe B — fond vert-fluo */}
        <div
          className="flex-1 flex flex-col bg-[#00FF66] cursor-pointer active:brightness-90 transition-all"
          onClick={() => addPoint('b')}
        >
          {/* Nom équipe */}
          <div className="p-5 pt-6 flex flex-col items-end text-right">
            <div className="inline-block bg-black/15 px-2 py-0.5 mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.1em] text-ink">
                ÉQUIPE B
              </span>
            </div>
            {teamB.split(' / ').map((name, i) => (
              <div key={i}
                className="font-black uppercase tracking-[-0.02em] leading-[0.95] text-ink"
                style={{ fontSize: teamB.includes(' / ') ? 'clamp(20px, calc((100vw - 256px) * 0.038), 52px)' : 'clamp(24px, calc((100vw - 256px) * 0.05), 68px)' }}>
                {name}
              </div>
            ))}
          </div>

          {/* Score — ferré à droite */}
          <div className="flex-1 flex flex-col items-end justify-center gap-4 pr-6">
            <GiantScore value={currentSet.b} isServer={server === 'b'} textClass="text-ink" />
            {/* Badges sets précédents */}
            {sets.length > 1 && (
              <div className="flex gap-1.5">
                {sets.slice(0, -1).map((s, i) => (
                  <span key={i}
                    className={`text-[11px] font-mono font-bold px-2 py-1
                      ${s.b > s.a ? 'bg-ink text-green-fluo' : 'bg-black/15 text-ink/50'}`}>
                    {s.b}
                  </span>
                ))}
              </div>
            )}
            <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink/50">
              Touche B ou →
            </p>
          </div>

          {/* Bouton +1 point */}
          <button
              className="w-full py-5 bg-ink text-green-fluo font-black text-[18px]
                uppercase tracking-[0.05em] hover:brightness-110 active:brightness-90 transition-colors
                border-t-2 border-ink/30 min-h-[64px]"
              onClick={(e) => { e.stopPropagation(); addPoint('b') }}
            >
              + 1 POINT [B]
            </button>
        </div>
      </div>

      {/* ── Valider le set — barre pleine largeur ───────────────────────── */}
      {currentSetDone && !matchDone && (
        <button
          onClick={validateSet}
          className="w-full py-5 bg-ink text-green-fluo font-black text-[16px]
            uppercase tracking-[0.05em] hover:brightness-110 transition-colors
            border-t-2 border-line shrink-0 min-h-[64px]"
        >
          VALIDER LE SET →
        </button>
      )}

      {/* ── Ruban point-par-point ────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 min-h-[48px] bg-bg-strong border-t-2 border-line shrink-0 overflow-hidden">
        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 shrink-0">
          POINT PAR POINT · SET {currentSetIndex + 1}
        </span>
        <div className="flex gap-1 overflow-x-auto scrollbar-none flex-1">
          {currentSetHistory.map((h, i) => (
            <div
              key={i}
              className={`shrink-0 w-5 h-5 flex items-center justify-center
                text-[9px] font-mono font-bold
                ${h.side === 'a' ? 'bg-[#0047FF] text-white' : 'bg-[#00FF66] text-ink'}`}
            >
              {h.side === 'a' ? 'A' : 'B'}
            </div>
          ))}
          {currentSetHistory.length === 0 && (
            <span className="text-[10px] font-mono text-ink-3 italic">Aucun point encore</span>
          )}
        </div>
      </div>

      {/* ── Footer raccourcis clavier ──────────────────────────────────── */}
      <div className="flex items-center justify-center gap-5 px-6 py-2 bg-bg-alt border-t border-line-soft shrink-0">
        {[
          { key: 'A / ←', action: '+1 Équipe A' },
          { key: 'B / →', action: '+1 Équipe B' },
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
