import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useTournamentsStore } from '@/store/tournamentsStore'
import { usePlayersStore } from '@/store/playersStore'
import { useRulesStore } from '@/store/rulesStore'
import { Button, Badge, Modal, Tag } from '@/components/ui'
import { Play, ChevronLeft, Users, BarChart3, List, GitBranch, CheckCircle, Archive, Shuffle, Plus, X, Pencil, Radio, Printer, LayoutGrid, ExternalLink, RefreshCw } from 'lucide-react'
import { playerDisplayName, CATEGORY_LABELS } from '@/types/domain'
import { generateRoundRobin } from '@/engine/generators/roundRobin'
import { generateSingleElim } from '@/engine/generators/singleElim'
import { generateAmericano } from '@/engine/generators/americano'
import { generatePoolPlusKnockout } from '@/engine/generators/poolPlusKnockout'
import { computeStandings } from '@/engine/standings'
import { computeMatchResult } from '@/engine/scoring'
import type { Match, MatchScore, MatchCategory, ScoringRule, Player } from '@/types/domain'

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'planning' | 'standings' | 'pools' | 'bracket' | 'players'

/** Map catégorie doubles → liste de paires [joueurA, joueurB] */
type PairMap = Map<MatchCategory, [number, number][]>

const DOUBLES_CATEGORIES: MatchCategory[] = ['DH', 'DD', 'DX']

// ─── Helpers paires ───────────────────────────────────────────────────────────

function eligibleForSlot(cat: MatchCategory, slot: 0 | 1, players: Player[]): Player[] {
  if (cat === 'DX') return slot === 0 ? players.filter((p) => p.gender === 'M') : players.filter((p) => p.gender === 'F')
  if (cat === 'DH') return players.filter((p) => p.gender === 'M')
  if (cat === 'DD') return players.filter((p) => p.gender === 'F')
  return players
}

function buildRandomPairs(players: Player[], cat: MatchCategory): [number, number][] {
  if (cat === 'DX') {
    const males = [...players.filter((p) => p.gender === 'M')].sort(() => Math.random() - 0.5)
    const females = [...players.filter((p) => p.gender === 'F')].sort(() => Math.random() - 0.5)
    const count = Math.min(males.length, females.length)
    return Array.from({ length: count }, (_, i) => [males[i].id, females[i].id])
  }
  const eligible = cat === 'DH'
    ? players.filter((p) => p.gender === 'M')
    : cat === 'DD'
      ? players.filter((p) => p.gender === 'F')
      : players
  const shuffled = [...eligible].sort(() => Math.random() - 0.5)
  const pairs: [number, number][] = []
  for (let i = 0; i + 1 < shuffled.length; i += 2) pairs.push([shuffled[i].id, shuffled[i + 1].id])
  return pairs
}

// ─── Modal constitution équipes doubles ───────────────────────────────────────

/** Carte joueur mini cliquable — utilisée dans la modal et le step 6 */
function PlayerMiniCardModal({
  player,
  selected,
  onSelect,
  onRemove,
  placeholder,
  onClick,
}: {
  player?: Player
  selected?: boolean
  onSelect?: () => void
  onRemove?: () => void
  placeholder?: string
  onClick?: () => void
}) {
  const isH = player?.gender === 'M'
  const initials = player
    ? playerDisplayName(player).split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2)
    : '?'

  if (!player) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-line-soft hover:border-blue
          min-h-[52px] w-full transition-colors text-left"
      >
        <div className="w-6 h-6 flex items-center justify-center bg-bg-strong text-ink-3 font-mono font-bold text-[10px] shrink-0">?</div>
        <span className="font-sans text-[12px] text-ink-3 italic">{placeholder ?? 'Sélectionner…'}</span>
      </button>
    )
  }

  return (
    <div
      onClick={onSelect ?? onClick}
      className={`relative flex items-center gap-2 px-3 py-2 border-2 min-h-[52px] w-full transition-all
        ${onSelect || onClick ? 'cursor-pointer' : 'cursor-default'}
        ${selected ? 'border-blue' : 'border-line hover:border-ink'}`}
      style={selected ? { backgroundColor: 'rgba(0,71,255,0.06)' } : {}}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: isH ? '#0047FF' : '#00C24A' }} />
      <div className="w-6 h-6 flex items-center justify-center font-mono font-black text-[10px] shrink-0 ml-2"
        style={{ backgroundColor: isH ? '#0047FF' : '#0a0a0a', color: isH ? '#fff' : '#00FF66' }}>
        {initials}
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="font-sans font-bold text-[12px] text-ink truncate leading-tight">{playerDisplayName(player)}</span>
        {player.club && <span className="font-mono text-[10px] text-ink-3 truncate">{player.club}</span>}
      </div>
      <Tag label={isH ? 'H' : 'F'} color={isH ? 'H' : 'F'} />
      {onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="shrink-0 w-6 h-6 flex items-center justify-center text-ink-3 hover:text-red transition-colors ml-1">
          <X size={11} />
        </button>
      )}
    </div>
  )
}

function DoublesSetupModal({
  isOpen,
  onClose,
  doublesCategories,
  participantPlayers,
  initialPairs,
  onSave,
}: {
  isOpen: boolean
  onClose: () => void
  doublesCategories: MatchCategory[]
  participantPlayers: Player[]
  initialPairs: PairMap
  onSave: (pairs: PairMap) => void
}) {
  const [localPairs, setLocalPairs] = useState<PairMap>(new Map(initialPairs))
  const [activeTab, setActiveTab] = useState<MatchCategory>(doublesCategories[0])
  const [pendingId, setPendingId] = useState<number | null>(null)

  useEffect(() => {
    if (isOpen) {
      setLocalPairs(new Map(initialPairs))
      setActiveTab(doublesCategories[0])
      setPendingId(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const currentPairs = localPairs.get(activeTab) ?? []

  const setPairs = (cat: MatchCategory, pairs: [number, number][]) => {
    setLocalPairs((m) => new Map(m).set(cat, pairs))
    setPendingId(null)
  }

  const handleShuffle = () => {
    setPendingId(null)
    setLocalPairs((m) => new Map(m).set(activeTab, buildRandomPairs(participantPlayers, activeTab)))
  }

  const addPair = () => {
    setLocalPairs((m) => new Map(m).set(activeTab, [...(m.get(activeTab) ?? []), [0, 0]]))
  }

  const removePair = (idx: number) => {
    setPairs(activeTab, currentPairs.filter((_, i) => i !== idx))
  }

  const removeFromSlot = (pairIdx: number, slot: 0 | 1) => {
    const updated = [...currentPairs] as [number, number][]
    updated[pairIdx] = slot === 0 ? [0, updated[pairIdx][1]] : [updated[pairIdx][0], 0]
    setPairs(activeTab, updated)
  }

  const assignToSlot = (pairIdx: number, slot: 0 | 1) => {
    if (!pendingId) return
    const updated = [...currentPairs] as [number, number][]
    if (updated[pairIdx][slot] === pendingId) { setPendingId(null); return }
    updated[pairIdx] = slot === 0
      ? [pendingId, updated[pairIdx][1]]
      : [updated[pairIdx][0], pendingId]
    setPairs(activeTab, updated)
  }

  // IDs assignés dans cette catégorie
  const assignedIds = new Set(currentPairs.flatMap(([a, b]) => [a, b].filter((x) => x > 0)))

  const poolFor = (slot: 0 | 1) =>
    eligibleForSlot(activeTab, slot, participantPlayers).filter((p) => !assignedIds.has(p.id))
  const poolMen   = activeTab === 'DX' ? poolFor(0) : []
  const poolWomen = activeTab === 'DX' ? poolFor(1) : []
  const poolAll   = activeTab !== 'DX' ? poolFor(0) : []

  const validPairs = currentPairs.filter(([a, b]) => a > 0 && b > 0 && a !== b)
  const totalValid = doublesCategories.every((cat) => {
    const pairs = localPairs.get(cat) ?? []
    return pairs.filter(([a, b]) => a > 0 && b > 0 && a !== b).length >= 2
  })

  const slotHint = (slot: 0 | 1) => {
    if (activeTab === 'DX') return slot === 0 ? 'Joueur (H)' : 'Joueuse (F)'
    if (activeTab === 'DH') return slot === 0 ? 'Joueur 1 (H)' : 'Joueur 2 (H)'
    return slot === 0 ? 'Joueuse 1 (F)' : 'Joueuse 2 (F)'
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Constitution des équipes doubles"
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" disabled={!totalValid} onClick={() => { onSave(localPairs); onClose() }}>
            Valider les équipes
          </Button>
        </>
      }
    >
      {/* Onglets catégories si plusieurs */}
      {doublesCategories.length > 1 && (
        <div className="flex gap-0 mb-5 border-2 border-line self-start w-fit">
          {doublesCategories.map((cat) => {
            const valid = (localPairs.get(cat) ?? []).filter(([a, b]) => a > 0 && b > 0 && a !== b).length
            return (
              <button key={cat} onClick={() => { setActiveTab(cat); setPendingId(null) }}
                className={`px-4 py-2 font-mono font-bold text-[11px] uppercase tracking-[0.08em] transition-colors
                  ${activeTab === cat ? 'bg-ink text-green-fluo' : 'bg-bg text-ink-3 hover:text-ink border-r-2 border-line last:border-r-0'}`}>
                {cat}
                {valid > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 font-bold text-[9px] bg-green text-white">{valid}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Info + status */}
      <div className="flex items-center justify-between mb-4">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">
          {activeTab === 'DH' && 'Hommes — H + H'}
          {activeTab === 'DD' && 'Dames — F + F'}
          {activeTab === 'DX' && 'Mixte — Homme + Femme'}
          {' '}· {validPairs.length} paire{validPairs.length !== 1 ? 's' : ''} valide{validPairs.length !== 1 ? 's' : ''}
          {pendingId !== null && (
            <span className="ml-2 text-blue">
              · {playerDisplayName(participantPlayers.find((p) => p.id === pendingId)!)} sélectionné
            </span>
          )}
        </p>
        <Button variant="secondary" size="sm" onClick={handleShuffle}>
          <Shuffle size={12} className="mr-1.5 inline" /> Tirer au sort
        </Button>
      </div>

      {/* Layout pool + paires */}
      <div className="flex gap-5 items-start">
        {/* Pool disponibles */}
        <div className="w-[180px] shrink-0 flex flex-col gap-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3">Disponibles</span>
          {activeTab === 'DX' ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono font-bold tracking-[0.06em] text-blue">H</span>
                {poolMen.length === 0
                  ? <p className="text-[11px] font-sans text-ink-3 italic">Tous assignés</p>
                  : poolMen.map((p) => (
                    <PlayerMiniCardModal key={p.id} player={p}
                      selected={pendingId === p.id}
                      onSelect={() => setPendingId(pendingId === p.id ? null : p.id)}
                    />
                  ))
                }
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono font-bold tracking-[0.06em]" style={{ color: '#00C24A' }}>F</span>
                {poolWomen.length === 0
                  ? <p className="text-[11px] font-sans text-ink-3 italic">Toutes assignées</p>
                  : poolWomen.map((p) => (
                    <PlayerMiniCardModal key={p.id} player={p}
                      selected={pendingId === p.id}
                      onSelect={() => setPendingId(pendingId === p.id ? null : p.id)}
                    />
                  ))
                }
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {poolAll.length === 0
                ? <p className="text-[11px] font-sans text-ink-3 italic">Tous assignés</p>
                : poolAll.map((p) => (
                  <PlayerMiniCardModal key={p.id} player={p}
                    selected={pendingId === p.id}
                    onSelect={() => setPendingId(pendingId === p.id ? null : p.id)}
                  />
                ))
              }
            </div>
          )}
        </div>

        {/* Paires */}
        <div className="flex-1 flex flex-col gap-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3">Paires</span>
          {currentPairs.map((pair, pairIdx) => {
            const playerA = participantPlayers.find((p) => p.id === pair[0])
            const playerB = participantPlayers.find((p) => p.id === pair[1])
            return (
              <div key={pairIdx} className="flex items-stretch gap-1.5">
                <span className="font-mono text-[10px] text-ink-3 w-4 shrink-0 text-right pt-4">{pairIdx + 1}</span>
                <div className="flex-1">
                  {playerA
                    ? <PlayerMiniCardModal player={playerA}
                        selected={pendingId !== null}
                        onRemove={() => removeFromSlot(pairIdx, 0)}
                        onClick={pendingId !== null ? () => assignToSlot(pairIdx, 0) : undefined}
                      />
                    : <PlayerMiniCardModal placeholder={slotHint(0)}
                        onClick={() => assignToSlot(pairIdx, 0)}
                      />
                  }
                </div>
                <div className="flex items-center shrink-0 pt-1">
                  <span className="font-mono font-bold text-[10px] text-ink-3">+</span>
                </div>
                <div className="flex-1">
                  {playerB
                    ? <PlayerMiniCardModal player={playerB}
                        selected={pendingId !== null}
                        onRemove={() => removeFromSlot(pairIdx, 1)}
                        onClick={pendingId !== null ? () => assignToSlot(pairIdx, 1) : undefined}
                      />
                    : <PlayerMiniCardModal placeholder={slotHint(1)}
                        onClick={() => assignToSlot(pairIdx, 1)}
                      />
                  }
                </div>
                <button onClick={() => removePair(pairIdx)}
                  className="shrink-0 w-7 flex items-center justify-center text-ink-3 hover:text-red transition-colors border-2 border-transparent hover:border-red">
                  <X size={12} />
                </button>
              </div>
            )
          })}
          <button onClick={addPair}
            className="flex items-center gap-1.5 mt-1 py-2 px-3 border-2 border-dashed border-line-soft hover:border-blue
              font-sans font-bold text-[12px] text-ink-3 hover:text-blue transition-colors self-start">
            <Plus size={11} /> Ajouter une paire
          </button>
        </div>
      </div>
    </Modal>
  )
}

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

// Couleurs des équipes de préparation (même palette que le Wizard)
const TEAM_COLORS_HEX: string[] = [
  '#0047FF', // A — bleu
  '#0a0a0a', // B — ink
  '#D97500', // C — warn
  '#E60022', // D — red
  '#00C24A', // E — vert
  '#4a4a4a', // F — gris foncé
  '#6600cc', // G — violet
  '#008080', // H — teal
]

/** Retourne la couleur hex de l'équipe-préparation d'un joueur, ou null si non assigné */
function getTeamColor(teamStr: string | undefined, playerTeamMap: Map<number, string>): string | null {
  if (!teamStr || teamStr === 'BYE') return null
  const ids = teamStr.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
  const side = ids.length > 0 ? playerTeamMap.get(ids[0]) : undefined
  if (!side) return null
  const idx = side.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0)
  return TEAM_COLORS_HEX[idx] ?? TEAM_COLORS_HEX[TEAM_COLORS_HEX.length - 1]
}

// ─── Utilitaire ───────────────────────────────────────────────────────────────

function resolveTeam(teamStr: string | undefined, playerNames: Map<number, string>): string {
  if (!teamStr || teamStr === 'BYE') return teamStr === 'BYE' ? 'BYE' : '?'
  const ids = teamStr.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
  if (ids.length === 0) return '?'
  return ids.map((id) => playerNames.get(id) ?? `Joueur ${id}`).join(' / ')
}

// ─── Modal de saisie rapide de score ─────────────────────────────────────────

function ScoreEditorModal({
  isOpen,
  onClose,
  match,
  teamAName,
  teamBName,
  rule,
  existingScores,
  onSaved,
}: {
  isOpen: boolean
  onClose: () => void
  match: Match | null
  teamAName: string
  teamBName: string
  rule: ScoringRule | undefined
  existingScores: MatchScore[]
  onSaved: () => void
}) {
  const setsToWin = rule?.setsToWin ?? 2
  const maxSets = setsToWin * 2 - 1

  const [scores, setScores] = useState<{ a: string; b: string }[]>([])
  const [saving, setSaving] = useState(false)

  // Initialise les scores à l'ouverture de la modale
  useEffect(() => {
    if (!isOpen) return
    setScores(
      Array.from({ length: maxSets }, (_, i) => {
        const ex = existingScores.find((s) => s.setNumber === i + 1)
        return ex ? { a: String(ex.scoreA), b: String(ex.scoreB) } : { a: '', b: '' }
      })
    )
  }, [isOpen, existingScores, maxSets])

  // Détermine le gagnant de chaque set
  const setWinners = scores.map(({ a, b }) => {
    const va = parseInt(a, 10)
    const vb = parseInt(b, 10)
    if (isNaN(va) || isNaN(vb) || (va === 0 && vb === 0 && a === '' && b === '')) return null
    if (va > vb) return 'A'
    if (vb > va) return 'B'
    return null
  })

  const setsWonA = setWinners.filter((w) => w === 'A').length
  const setsWonB = setWinners.filter((w) => w === 'B').length
  const winnerSide: 'A' | 'B' | null =
    setsWonA >= setsToWin ? 'A' : setsWonB >= setsToWin ? 'B' : null

  const filledCount = scores.filter(({ a, b }) => a !== '' || b !== '').length

  const getFirstId = (teamStr: string | undefined) => {
    if (!teamStr) return NaN
    return parseInt(teamStr.split(',')[0], 10)
  }

  const handleSave = async () => {
    if (saving || !match) return
    setSaving(true)
    try {
      for (let i = 0; i < scores.length; i++) {
        const { a, b } = scores[i]
        if (a === '' && b === '') continue
        await window.db.setMatchScore(match.id, i + 1, parseInt(a, 10) || 0, parseInt(b, 10) || 0)
      }
      const idA = getFirstId(match.teamA)
      const idB = getFirstId(match.teamB)
      // Ne pas passer winnerId à updateMatchStatus : la colonne référence tournament_players(id)
      // alors que idA/idB sont des players(id) — on évite la contrainte FK.
      // Le vainqueur est identifiable via les scores/participants.
      await window.db.updateMatchStatus(match.id, 'completed')
      // Avance le bracket en passant le players.id (advanceWinner fait la jointure en interne)
      const winnerPlayerId = winnerSide === 'A' ? idA : winnerSide === 'B' ? idB : undefined
      if (winnerPlayerId !== undefined && !isNaN(winnerPlayerId)) {
        await window.db.advanceWinner(match.tournamentId, match.id, winnerPlayerId)
      }
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleForfeit = async (forfeitSide: 'A' | 'B') => {
    if (saving || !match) return
    setSaving(true)
    try {
      const idA = getFirstId(match.teamA)
      const idB = getFirstId(match.teamB)
      // Forfait A → B gagne ; Forfait B → A gagne
      await window.db.updateMatchStatus(match.id, 'walkover')
      const winnerPlayerId = forfeitSide === 'A' ? idB : idA
      if (!isNaN(winnerPlayerId)) {
        await window.db.advanceWinner(match.tournamentId, match.id, winnerPlayerId)
      }
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (saving || !match) return
    setSaving(true)
    try {
      // Supprime les scores enregistrés avant de repasser en pending
      await window.db.clearMatchScores(match.id)
      await window.db.updateMatchStatus(match.id, 'pending')
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const updateScore = (setIdx: number, side: 'a' | 'b', val: string) => {
    setScores((prev) => {
      const next = [...prev]
      next[setIdx] = { ...next[setIdx], [side]: val }
      return next
    })
  }

  if (!match) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Saisie du score" size="md">
      {/* Noms des équipes */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center mb-6">
        <span className="font-sans font-black text-[16px] text-blue truncate">{teamAName}</span>
        <span className="text-[11px] font-mono font-bold text-ink-3 uppercase tracking-[0.06em]">vs</span>
        <span className="font-sans font-black text-[16px] text-ink text-right truncate">{teamBName}</span>
      </div>

      {/* Saisie set par set */}
      <div className="flex flex-col gap-2 mb-6">
        <div className="grid grid-cols-[56px_1fr_24px_1fr] gap-2 items-center mb-1">
          <span />
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-blue">Équipe A</span>
          <span />
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-ink-2">Équipe B</span>
        </div>
        {scores.map(({ a, b }, i) => {
          const w = setWinners[i]
          const isActive = a !== '' || b !== ''
          return (
            <div key={i} className="grid grid-cols-[56px_1fr_24px_1fr] gap-2 items-center">
              <span className="text-[11px] font-mono font-bold text-ink-3 text-right pr-2 uppercase tracking-[0.06em]">
                Set {i + 1}
              </span>
              <input
                type="number"
                min="0"
                max="99"
                value={a}
                onChange={(e) => updateScore(i, 'a', e.target.value)}
                className={`bg-bg border-2 px-3 py-2 font-mono text-[20px] font-bold text-center w-full focus:outline-none
                  transition-colors
                  ${!isActive ? 'border-line-soft text-ink-3' :
                    w === 'A' ? 'border-green text-green' :
                    w === 'B' ? 'border-line-soft text-ink-3' : 'border-line text-ink'}`}
              />
              <span className="text-[14px] font-mono text-ink-3 text-center">–</span>
              <input
                type="number"
                min="0"
                max="99"
                value={b}
                onChange={(e) => updateScore(i, 'b', e.target.value)}
                className={`bg-bg border-2 px-3 py-2 font-mono text-[20px] font-bold text-center w-full focus:outline-none
                  transition-colors
                  ${!isActive ? 'border-line-soft text-ink-3' :
                    w === 'B' ? 'border-green text-green' :
                    w === 'A' ? 'border-line-soft text-ink-3' : 'border-line text-ink'}`}
              />
            </div>
          )
        })}
      </div>

      {/* Indicateur vainqueur */}
      {winnerSide && (
        <div className="mb-6 px-4 py-3 border-2 border-green bg-green/5 flex items-center gap-3">
          <span className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3">Vainqueur</span>
          <span className="font-sans font-black text-[15px] text-green">
            {winnerSide === 'A' ? teamAName : teamBName}
          </span>
          <span className="font-mono text-[12px] text-ink-3 ml-auto">
            {setsWonA} – {setsWonB} sets
          </span>
        </div>
      )}

      {/* Actions secondaires */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void handleForfeit('A')} disabled={saving}>
            Forfait A
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void handleForfeit('B')} disabled={saving}>
            Forfait B
          </Button>
        </div>
        {(match.status === 'completed' || match.status === 'walkover') && (
          <Button variant="secondary" size="sm" onClick={() => void handleReset()} disabled={saving}>
            Remettre en attente
          </Button>
        )}
      </div>

      {/* Validation */}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Annuler
        </Button>
        <Button
          disabled={saving || filledCount === 0 || !winnerSide}
          onClick={() => void handleSave()}
        >
          {saving ? 'Enregistrement…' : 'Valider le score'}
        </Button>
      </div>
    </Modal>
  )
}

// ─── Onglet Planning ──────────────────────────────────────────────────────────

// ─── Modal création manuelle de match ────────────────────────────────────────

const MANUAL_CATS: { value: '' | MatchCategory; label: string }[] = [
  { value: '',   label: 'Sans catégorie' },
  { value: 'SH', label: 'SH — Simple H' },
  { value: 'SD', label: 'SD — Simple F' },
  { value: 'DH', label: 'DH — Double H' },
  { value: 'DD', label: 'DD — Double F' },
  { value: 'DX', label: 'DX — Mixte' },
]

function AddMatchModal({
  isOpen,
  onClose,
  tournamentId,
  tournamentPlayerRows,
  allPlayerNames,
  courtCount,
  onCreated,
}: {
  isOpen: boolean
  onClose: () => void
  tournamentId: number
  tournamentPlayerRows: import('@/types/domain').TournamentPlayer[]
  allPlayerNames: Map<number, string>
  courtCount: number
  onCreated: () => void
}) {
  const [cat, setCat] = useState<'' | MatchCategory>('')
  const [round, setRound] = useState('1')
  const [court, setCourt] = useState('1')
  const [sideA, setSideA] = useState<[number, number]>([0, 0])
  const [sideB, setSideB] = useState<[number, number]>([0, 0])
  const [saving, setSaving] = useState(false)

  const isDoubles = cat === 'DH' || cat === 'DD' || cat === 'DX'

  // Filtre les joueurs éligibles selon la catégorie et le slot
  const eligiblePlayers = (slot: 0 | 1): { id: number; name: string }[] => {
    const gender: 'M' | 'F' | null =
      cat === 'SH' || cat === 'DH' || (cat === 'DX' && slot === 0) ? 'M'
        : cat === 'SD' || cat === 'DD' || (cat === 'DX' && slot === 1) ? 'F'
        : null
    return tournamentPlayerRows
      .filter((r) => !gender || r.gender === gender)
      .map((r) => ({ id: r.playerId, name: allPlayerNames.get(r.playerId) ?? `#${r.playerId}` }))
  }

  // Réinitialise les sélections à l'ouverture
  useEffect(() => {
    if (!isOpen) return
    setCat('')
    setRound('1')
    setCourt('1')
    setSideA([0, 0])
    setSideB([0, 0])
  }, [isOpen])

  const handleSubmit = async () => {
    const roundN = parseInt(round, 10)
    const courtN = parseInt(court, 10)
    if (isNaN(roundN) || isNaN(courtN)) return
    setSaving(true)
    try {
      if (isDoubles) {
        await window.db.createMatchWithTeams({
          tournamentId,
          round: roundN,
          courtNumber: courtN,
          teamAPlayerIds: [sideA[0], sideA[1]],
          teamBPlayerIds: [sideB[0], sideB[1]],
          category: (cat as MatchCategory) || undefined,
        })
      } else {
        await window.db.createMatch({
          tournamentId,
          round: roundN,
          courtNumber: courtN,
          playerAId: sideA[0],
          playerBId: sideB[0],
          category: (cat as MatchCategory) || undefined,
        })
      }
      onCreated()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const canSave = isDoubles
    ? sideA[0] > 0 && sideA[1] > 0 && sideB[0] > 0 && sideB[1] > 0
    : sideA[0] > 0 && sideB[0] > 0

  const PlayerSelect = ({
    value, onChange, slot, label,
  }: { value: number; onChange: (id: number) => void; slot: 0 | 1; label: string }) => (
    <select
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10))}
      className="w-full border-2 border-line bg-bg font-sans text-[13px] text-ink px-3 py-2 focus:outline-none focus:border-blue"
    >
      <option value={0}>— {label} —</option>
      {eligiblePlayers(slot).map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter un match manuellement" size="md">
      <div className="flex flex-col gap-4">

        {/* Discipline */}
        <div>
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-2">Discipline</p>
          <div className="flex flex-wrap gap-2">
            {MANUAL_CATS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setCat(opt.value); setSideA([0, 0]); setSideB([0, 0]) }}
                className={`px-3 py-1.5 border-2 font-mono font-bold text-[11px] uppercase tracking-[0.06em] transition-colors
                  ${cat === opt.value
                    ? 'bg-ink text-green-fluo border-ink'
                    : 'bg-bg text-ink border-line hover:border-blue'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ronde + Terrain */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-1">Ronde</p>
            <input
              type="number" min={1} value={round}
              onChange={(e) => setRound(e.target.value)}
              className="w-full border-2 border-line bg-bg font-sans text-[13px] text-ink px-3 py-2 focus:outline-none focus:border-blue"
            />
          </div>
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-1">Terrain</p>
            <input
              type="number" min={1} max={courtCount} value={court}
              onChange={(e) => setCourt(e.target.value)}
              className="w-full border-2 border-line bg-bg font-sans text-[13px] text-ink px-3 py-2 focus:outline-none focus:border-blue"
            />
          </div>
        </div>

        {/* Sélection joueurs */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-blue">Équipe A</p>
            <PlayerSelect value={sideA[0]} onChange={(v) => setSideA([v, sideA[1]])} slot={0} label={isDoubles ? 'Joueur A1' : 'Joueur A'} />
            {isDoubles && (
              <PlayerSelect value={sideA[1]} onChange={(v) => setSideA([sideA[0], v])} slot={1} label="Joueur A2" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-ink-2">Équipe B</p>
            <PlayerSelect value={sideB[0]} onChange={(v) => setSideB([v, sideB[1]])} slot={0} label={isDoubles ? 'Joueur B1' : 'Joueur B'} />
            {isDoubles && (
              <PlayerSelect value={sideB[1]} onChange={(v) => setSideB([sideB[0], v])} slot={1} label="Joueur B2" />
            )}
          </div>
        </div>

        <Button disabled={!canSave || saving} onClick={() => void handleSubmit()}>
          <Plus size={13} className="mr-1 inline" />
          {saving ? 'Ajout…' : 'Ajouter ce match'}
        </Button>
      </div>
    </Modal>
  )
}

// ─── Onglet Planning ──────────────────────────────────────────────────────────

function PlanningTab({
  matches,
  tournamentId,
  hasCats,
  allPlayerNames,
  allScores,
  rule,
  tournamentFormat,
  onRefresh,
  navigate,
  swapMode = false,
  swapSlot = null,
  onSwapSelect,
  onSwapPositions,
  playerTeamMap,
  readOnly = false,
  onCourtChange,
  courtCount,
}: {
  matches: Match[]
  tournamentId: number
  hasCats: boolean
  allPlayerNames: Map<number, string>
  allScores: Map<number, MatchScore[]>
  rule: ScoringRule | undefined
  tournamentFormat: string
  onRefresh: () => void
  navigate: ReturnType<typeof useNavigate>
  swapMode?: boolean
  swapSlot?: { matchId: number; side: 'A' | 'B' } | null
  onSwapSelect?: (matchId: number, side: 'A' | 'B') => void
  onSwapPositions?: (matchId1: number, matchId2: number) => void
  playerTeamMap?: Map<number, string>
  readOnly?: boolean
  onCourtChange?: (matchId: number, courtNumber: number | null) => void
  courtCount?: number
}) {
  const [filterCat, setFilterCat] = useState<MatchCategory | 'all'>('all')
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [dragMatchId, setDragMatchId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)

  // Détecte si le bracket knockout peut être généré depuis les poules
  const canSeedKnockout = useMemo(() => {
    if (tournamentFormat !== 'pool+knockout') return false
    const poolMatches = matches.filter((m) => (m.round ?? 0) < 100)
    if (poolMatches.length === 0) return false
    const poolsDone = poolMatches.every((m) => m.status === 'completed' || m.status === 'walkover')
    const ko101 = matches.filter((m) => m.round === 101)
    const knockoutEmpty = ko101.length > 0 && ko101.every((m) => !m.teamA && !m.teamB)
    return poolsDone && knockoutEmpty
  }, [matches, tournamentFormat])

  // Ref vers handleSeedKnockout pour l'auto-seed (toujours la version la plus récente)
  const handleSeedKnockoutRef = useRef<() => Promise<void>>(async () => {})

  // Calcule les classements par groupe et insère les participants dans le knockout
  const handleSeedKnockout = async () => {
    if (seeding) return
    setSeeding(true)
    try {
      const seeds: { matchId: number; side: 'A' | 'B'; playerIds: number[]; tournamentId: number }[] = []
      const poolMatches = matches.filter((m) => (m.round ?? 0) < 100)
      const presentCats = Array.from(new Set(poolMatches.map((m) => m.category).filter(Boolean))) as MatchCategory[]
      const rangeCategories: (MatchCategory | undefined)[] = presentCats.length > 0 ? presentCats : [undefined]

      for (const cat of rangeCategories) {
        const catPool = cat ? poolMatches.filter((m) => m.category === cat) : poolMatches

        // Collecte dynamiquement tous les groupes présents (Groupe A, Groupe B, Groupe C…)
        const allGroupNames = [...new Set(catPool.map((m) => m.comment))]
          .filter((c): c is string => typeof c === 'string' && c.startsWith('Groupe'))
          .sort()

        if (allGroupNames.length === 0) continue

        // Classe les équipes d'un groupe par nombre de victoires puis ratio points
        const rankTeams = (groupMatches: Match[]) => {
          const teams = new Set<string>()
          for (const m of groupMatches) {
            if (m.teamA) teams.add(m.teamA)
            if (m.teamB) teams.add(m.teamB)
          }
          const wins = new Map<string, number>()
          const pts = new Map<string, number>()
          for (const team of teams) { wins.set(team, 0); pts.set(team, 0) }
          for (const m of groupMatches) {
            if (m.status !== 'completed' && m.status !== 'walkover') continue
            const ms = allScores.get(m.id) ?? []
            // Utilise la règle si disponible, sinon fallback sur winnerSide stocké en DB
            let winnerSide: 'A' | 'B' | null = null
            if (rule && ms.length > 0) {
              const result = computeMatchResult(ms, rule)
              winnerSide = result.winner
            }
            if (!winnerSide) winnerSide = m.winnerSide ?? null
            if (!winnerSide) continue
            const winner = winnerSide === 'A' ? m.teamA : m.teamB
            if (winner) wins.set(winner, (wins.get(winner) ?? 0) + 1)
            for (const s of ms) {
              const ta = m.teamA ?? ''; const tb = m.teamB ?? ''
              pts.set(ta, (pts.get(ta) ?? 0) + s.scoreA)
              pts.set(tb, (pts.get(tb) ?? 0) + s.scoreB)
            }
          }
          return Array.from(teams)
            .map((t) => ({ team: t, wins: wins.get(t) ?? 0, pts: pts.get(t) ?? 0 }))
            .sort((a, b) => b.wins - a.wins || b.pts - a.pts)
        }

        const groupRankings = new Map<string, ReturnType<typeof rankTeams>>()
        for (const groupName of allGroupNames) {
          groupRankings.set(groupName, rankTeams(catPool.filter((m) => m.comment === groupName)))
        }

        const ko1 = matches
          .filter((m) => m.round === 101 && (cat ? m.category === cat : true))
          .sort((a, b) => a.id - b.id)
        if (ko1.length === 0) continue

        const parseIds = (team: string) => team.split(',').map(Number).filter((n) => !isNaN(n) && n > 0)

        if (allGroupNames.length === 2) {
          // 2 groupes : cross-seeding classique A1 vs B2, B1 vs A2
          const [rA, rB] = [groupRankings.get(allGroupNames[0]) ?? [], groupRankings.get(allGroupNames[1]) ?? []]
          if (rA.length === 0 || rB.length === 0) continue
          if (ko1.length === 1) {
            seeds.push({ matchId: ko1[0].id, side: 'A', playerIds: parseIds(rA[0].team), tournamentId })
            seeds.push({ matchId: ko1[0].id, side: 'B', playerIds: parseIds(rB[0].team), tournamentId })
          } else {
            seeds.push({ matchId: ko1[0].id, side: 'A', playerIds: parseIds(rA[0].team), tournamentId })
            seeds.push({ matchId: ko1[0].id, side: 'B', playerIds: parseIds((rB[1] ?? rB[0]).team), tournamentId })
            seeds.push({ matchId: ko1[1].id, side: 'A', playerIds: parseIds(rB[0].team), tournamentId })
            seeds.push({ matchId: ko1[1].id, side: 'B', playerIds: parseIds((rA[1] ?? rA[0]).team), tournamentId })
          }
        } else {
          // N groupes : 1ers de chaque groupe + repêchage des meilleurs non-qualifiants
          const slotsNeeded = ko1.length * 2
          const qualifiers: string[] = []
          const maxRankNeeded = Math.ceil(slotsNeeded / allGroupNames.length)

          for (let rank = 0; rank < maxRankNeeded; rank++) {
            // Inverser l'ordre des groupes pour les runners-up = cross-seeding anti-rematch
            const orderedGroups = rank % 2 === 0 ? [...allGroupNames] : [...allGroupNames].reverse()
            for (const groupName of orderedGroups) {
              const ranked = groupRankings.get(groupName) ?? []
              if (ranked[rank]) qualifiers.push(ranked[rank].team)
            }
          }

          // Repêchage : si le bracket n'est pas plein, prendre les meilleurs non-qualifiants
          if (qualifiers.length < slotsNeeded) {
            const alreadyQualified = new Set(qualifiers)
            const runners: { team: string; wins: number; pts: number }[] = []
            for (const groupName of allGroupNames) {
              for (const r of groupRankings.get(groupName) ?? []) {
                if (!alreadyQualified.has(r.team)) runners.push(r)
              }
            }
            runners.sort((a, b) => b.wins - a.wins || b.pts - a.pts)
            const needed = slotsNeeded - qualifiers.length
            qualifiers.push(...runners.slice(0, needed).map((r) => r.team))
          }

          // Distribue dans les slots KO1 : A et B alternés
          for (let i = 0; i < ko1.length && i * 2 + 1 < qualifiers.length; i++) {
            seeds.push({ matchId: ko1[i].id, side: 'A', playerIds: parseIds(qualifiers[i * 2]), tournamentId })
            seeds.push({ matchId: ko1[i].id, side: 'B', playerIds: parseIds(qualifiers[i * 2 + 1]), tournamentId })
          }
        }
      }

      if (seeds.length > 0) {
        await window.db.seedKnockoutMatches(seeds)
        // Auto-avance les qualifiants qui font face à un BYE (slot vide de l'autre côté)
        const freshMatches = await window.db.getMatches(tournamentId)
        for (const m of freshMatches.filter((m2) => m2.round === 101)) {
          if (m.teamA && !m.teamB) {
            const winnerId = parseInt(m.teamA.split(',')[0], 10)
            if (!isNaN(winnerId)) {
              await window.db.updateMatchStatus(m.id, 'walkover')
              await window.db.advanceWinner(tournamentId, m.id, winnerId)
            }
          } else if (!m.teamA && m.teamB) {
            const winnerId = parseInt(m.teamB.split(',')[0], 10)
            if (!isNaN(winnerId)) {
              await window.db.updateMatchStatus(m.id, 'walkover')
              await window.db.advanceWinner(tournamentId, m.id, winnerId)
            }
          }
        }
        onRefresh()
      }
    } finally {
      setSeeding(false)
    }
  }

  // Mise à jour de la ref + auto-déclenchement dès que toutes les poules sont terminées
  handleSeedKnockoutRef.current = handleSeedKnockout
  useEffect(() => {
    if (canSeedKnockout) {
      void handleSeedKnockoutRef.current()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSeedKnockout])

  // Formate les scores d'un match en "21-15  21-17"
  const formatScores = useCallback((matchId: number): string => {
    const sets = (allScores.get(matchId) ?? [])
      .slice()
      .sort((a, b) => a.setNumber - b.setNumber)
    if (sets.length === 0) return ''
    return sets.map((s) => `${s.scoreA}-${s.scoreB}`).join('  ')
  }, [allScores])

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

  const colsHeader = hasCats
    ? 'grid-cols-[1fr_1fr_150px_80px_120px_180px]'
    : 'grid-cols-[1fr_1fr_150px_80px_180px]'

  const selectedTeamA = selectedMatch ? resolveTeam(selectedMatch.teamA, allPlayerNames) : ''
  const selectedTeamB = selectedMatch ? resolveTeam(selectedMatch.teamB, allPlayerNames) : ''

  return (
    <div className="flex flex-col gap-6">
      {canSeedKnockout && (
        <div className="flex items-center gap-4 p-4 border-2 border-green bg-bg-strong">
          <div className="flex-1">
            <p className="font-black uppercase text-[14px] tracking-[-0.01em] text-ink">Phase de poules terminée !</p>
            <p className="font-sans text-[13px] text-ink-2 mt-0.5">
              Cliquez sur le bouton pour générer le tableau final (demi-finales, finale…) en fonction du classement des poules.
            </p>
          </div>
          <button
            onClick={() => { void handleSeedKnockout() }}
            disabled={seeding}
            className="shrink-0 px-4 py-2.5 bg-ink text-green-fluo font-black uppercase text-[12px] tracking-[0.05em] border-2 border-ink hover:opacity-80 disabled:opacity-50 transition-opacity"
          >
            {seeding ? 'Génération…' : 'Lancer le bracket ▶'}
          </button>
        </div>
      )}
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
          <p className="font-sans text-[14px] text-ink-3">Cliquez sur « Générer le planning » pour prévisualiser les matchs.</p>
        </div>
      ) : (
        byRound.map(([round, roundMatches]) => (
          <div key={round}>
            <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-2">
              {round >= 100 ? `Knockout — Tour ${round - 99}` : `Ronde ${round}`}
            </p>
            <div className="flex flex-col border-2 border-line">
              <div className={`grid ${colsHeader} bg-ink px-4 py-2`}>
                {['Équipe A', 'Équipe B', 'Score', 'Terrain', ...(hasCats ? ['Discipline'] : []), 'Statut'].map((h) => (
                  <span key={h} className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-green-fluo">{h}</span>
                ))}
              </div>
              {roundMatches.map((m, i) => {
                const isWinA = m.status === 'completed' && m.winnerSide === 'A'
                const isWinB = m.status === 'completed' && m.winnerSide === 'B'
                const isDone = m.status === 'completed' || m.status === 'walkover'
                const scoreStr = formatScores(m.id)
                const isSelectedA = swapSlot?.matchId === m.id && swapSlot?.side === 'A'
                const isSelectedB = swapSlot?.matchId === m.id && swapSlot?.side === 'B'

                const teamCell = (side: 'A' | 'B', isWin: boolean, isSelected: boolean) => {
                  const rawTeam = side === 'A' ? m.teamA : m.teamB
                  const ids = rawTeam && rawTeam !== 'BYE'
                    ? rawTeam.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
                    : []

                  // Un dot + nom par joueur (singles = 1, doubles = 2)
                  const chips = ids.map((id) => {
                    const name = allPlayerNames.get(id) ?? `Joueur ${id}`
                    const teamSide = playerTeamMap?.get(id)
                    const color = teamSide
                      ? (TEAM_COLORS_HEX[teamSide.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0)] ?? null)
                      : null
                    return { name, color }
                  })

                  const innerContent = chips.length > 0
                    ? chips.map((p, i) => (
                        <span key={i} className="inline-flex items-center gap-1 shrink-0">
                          {i > 0 && <span className="text-ink-3 mx-0.5 font-normal">/</span>}
                          {p.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />}
                          <span>{p.name}</span>
                        </span>
                      ))
                    : [<span key="fb" className="text-ink-3">{rawTeam === 'BYE' ? 'BYE' : '?'}</span>]

                  if (swapMode && onSwapSelect) {
                    return (
                      <button
                        className={`font-sans font-bold text-[14px] text-left px-1 border-2 transition-colors flex items-center gap-1 flex-wrap
                          ${isSelected
                            ? 'border-blue bg-blue text-white'
                            : swapSlot
                              ? 'border-blue text-ink hover:bg-blue/10 cursor-pointer'
                              : 'border-dashed border-line-soft text-ink hover:border-blue hover:bg-blue/5 cursor-pointer'}`}
                        onClick={(e) => { e.stopPropagation(); onSwapSelect(m.id, side) }}
                      >
                        {innerContent}
                      </button>
                    )
                  }
                  return (
                    <span className={`font-sans font-bold text-[14px] flex items-center gap-1 flex-wrap ${isWin ? 'text-green' : isDone ? 'text-ink-3' : 'text-ink'}`}>
                      {innerContent}
                    </span>
                  )
                }

                return (
                  <div key={m.id}
                    draggable={swapMode && !!onSwapPositions}
                    onDragStart={() => { setDragMatchId(m.id); setDragOverId(null) }}
                    onDragEnd={() => { setDragMatchId(null); setDragOverId(null) }}
                    onDragOver={(e) => { e.preventDefault(); if (dragMatchId !== m.id) setDragOverId(m.id) }}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (dragMatchId && dragMatchId !== m.id && onSwapPositions) onSwapPositions(dragMatchId, m.id)
                      setDragMatchId(null); setDragOverId(null)
                    }}
                    className={`grid ${colsHeader} items-center px-4 py-3
                      border-b border-line-soft transition-colors
                      ${swapMode ? 'cursor-grab' : 'hover:bg-bg-strong cursor-pointer'}
                      ${i % 2 === 0 ? 'bg-bg' : 'bg-bg-alt'}
                      ${isSelectedA || isSelectedB ? 'ring-2 ring-inset ring-blue' : ''}
                      ${dragOverId === m.id && dragMatchId !== m.id ? 'ring-2 ring-inset ring-green' : ''}
                      ${dragMatchId === m.id ? 'opacity-50' : ''}`}
                    onClick={() => { if (!swapMode && !readOnly) setSelectedMatch(m) }}
                  >
                    {teamCell('A', isWinA, isSelectedA)}
                    {teamCell('B', isWinB, isSelectedB)}
                    {/* Score compact */}
                    <span className={`font-mono font-bold text-[13px] tracking-[0.04em]
                      ${isDone ? 'text-ink' : 'text-ink-3'}`}>
                      {isDone && scoreStr ? scoreStr : m.status === 'walkover' ? 'Forfait' : '—'}
                    </span>
                    {swapMode && onCourtChange ? (
                      <input
                        type="number"
                        min={1}
                        max={courtCount ?? 99}
                        defaultValue={m.courtNumber ?? ''}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => {
                          const v = parseInt(e.target.value, 10)
                          onCourtChange(m.id, isNaN(v) || v < 1 ? null : v)
                        }}
                        className="w-10 border border-line text-center text-[11px] font-mono bg-bg text-ink py-0.5 outline-none focus:border-blue"
                        style={{ borderRadius: 0 }}
                      />
                    ) : (
                      <span className="text-[11px] font-mono text-ink-3">
                        {m.courtNumber != null ? `T${m.courtNumber}` : '—'}
                      </span>
                    )}
                    {hasCats && (
                      <span className="text-[11px] font-mono font-bold text-ink">
                        {m.category ?? '—'}
                      </span>
                    )}
                    {/* Statut + boutons d'action (masqués en mode réorganisation et en draft) */}
                    <div className="flex items-center gap-2">
                      {!swapMode && !readOnly && (
                        <>
                          {(() => {
                            const hasScores = (allScores.get(m.id) ?? []).length > 0
                            const needsValidation = m.status === 'in_progress' && hasScores
                            return (
                              <Badge variant={needsValidation ? 'warning' : (MATCH_STATUS_BADGE[m.status] ?? 'default')}>
                                {needsValidation ? 'À valider' : (MATCH_STATUS_LABELS[m.status] ?? m.status)}
                              </Badge>
                            )
                          })()}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/tournaments/${tournamentId}/match/${m.id}`)
                            }}
                            title="Ouvrir le mode arbitre ici"
                            className="p-1.5 text-ink-3 hover:text-blue transition-colors shrink-0"
                          >
                            <Radio size={13} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              void window.db.openNewWindow(`/tournaments/${tournamentId}/match/${m.id}?standalone=1`)
                            }}
                            title="Ouvrir le mode arbitre dans une nouvelle fenêtre"
                            className="p-1.5 text-ink-3 hover:text-blue transition-colors shrink-0"
                          >
                            <ExternalLink size={13} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedMatch(m) }}
                            title="Saisir le score"
                            className="p-1.5 text-ink-3 hover:text-blue transition-colors shrink-0"
                          >
                            <Pencil size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      <ScoreEditorModal
        isOpen={selectedMatch !== null}
        onClose={() => setSelectedMatch(null)}
        match={selectedMatch}
        teamAName={selectedTeamA}
        teamBName={selectedTeamB}
        rule={rule}
        existingScores={selectedMatch ? (allScores.get(selectedMatch.id) ?? []) : []}
        onSaved={() => { setSelectedMatch(null); onRefresh() }}
      />
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
  allPlayerNames,
}: {
  tournamentPlayers: number[]
  matches: Match[]
  allScores: Map<number, MatchScore[]>
  rule: ScoringRule | undefined
  players: ReturnType<typeof usePlayersStore.getState>['players']
  allPlayerNames: Map<number, string>
}) {
  const standings = useMemo(() => {
    if (matches.length === 0 || tournamentPlayers.length === 0) return []
    const playerNames = new Map(players.map((p) => [p.id, playerDisplayName(p)]))
    return computeStandings(tournamentPlayers, playerNames, matches, allScores, rule)
  }, [matches, allScores, tournamentPlayers, players, rule])

  // Classement par paires — pour les matchs doubles (teamA contient plusieurs IDs)
  const pairStandings = useMemo(() => {
    const doublesMatches = matches.filter((m) => m.teamA?.includes(',') || m.teamB?.includes(','))
    if (doublesMatches.length === 0) return []
    return computePoolTeamStandings(doublesMatches, allScores, allPlayerNames)
  }, [matches, allScores, allPlayerNames])

  if (standings.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {!rule && matches.length > 0 && (
          <p className="font-mono text-[11px] text-warn font-bold uppercase tracking-[0.06em] border-l-2 border-warn pl-3">
            Aucune règle de score configurée — le classement nécessite une règle.
          </p>
        )}
        <p className="font-sans text-[14px] text-ink-3">
          {matches.length === 0 ? 'Lancez le tournoi pour générer les matchs.' : 'En attente des premiers résultats.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Classement individuel */}
      <div className="flex flex-col border-2 border-line">
        <div className="grid grid-cols-[32px_1fr_100px_64px_120px_60px_60px_70px_80px] bg-ink px-4 py-3">
          {['#', 'Joueur', 'Pseudo', 'N° Doss', 'Équipe', 'V', 'D', 'Sets', 'Pts'].map((h) => (
            <span key={h} className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-green-fluo">{h}</span>
          ))}
        </div>
        {standings.map((entry, i) => {
          const p = players.find((pl) => pl.id === entry.playerId)
          return (
            <div key={entry.playerId}
              className={`grid grid-cols-[32px_1fr_100px_64px_120px_60px_60px_70px_80px] items-center px-4 py-3
                border-b border-line-soft ${i % 2 === 0 ? 'bg-bg' : 'bg-bg-alt'}`}>
              <span className={`text-[11px] font-mono font-bold ${i === 0 ? 'text-blue' : 'text-ink-3'}`}>{i + 1}</span>
              <span className="font-sans font-bold text-[14px] text-ink">{entry.playerName}</span>
              <span className="font-mono text-[12px] text-ink-3 truncate">{p?.pseudo ? `"${p.pseudo}"` : '—'}</span>
              <span className="font-mono text-[12px] text-ink-3">{p?.playerNumber != null ? String(p.playerNumber).padStart(2, '0') : '—'}</span>
              <span className="font-sans text-[12px] text-ink-2 truncate">{p?.club || '—'}</span>
              <span className="font-mono text-[14px] text-green font-bold">{entry.matchesWon}</span>
              <span className="font-mono text-[14px] text-ink-3">{entry.matchesLost}</span>
              <span className="font-mono text-[12px] text-ink-3">{entry.setsWon}/{entry.setsWon + entry.setsLost}</span>
              <span className={`font-mono font-bold text-[14px] ${i === 0 ? 'text-blue' : 'text-ink'}`}>{entry.rankPoints}</span>
            </div>
          )
        })}
      </div>

      {/* Classement par paires (doubles uniquement) */}
      {pairStandings.length > 0 && (
        <div className="flex flex-col border-2 border-line">
          <div className="grid grid-cols-[32px_1fr_60px_60px_60px] bg-ink px-4 py-3">
            {['#', 'Paire', 'V', 'D', '±Pts'].map((h) => (
              <span key={h} className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-green-fluo">{h}</span>
            ))}
          </div>
          {pairStandings.map((entry, i) => {
            const diff = entry.ptWon - entry.ptLost
            return (
              <div key={entry.key}
                className={`grid grid-cols-[32px_1fr_60px_60px_60px] items-center px-4 py-3
                  border-b border-line-soft ${i % 2 === 0 ? 'bg-bg' : 'bg-bg-alt'}`}>
                <span className={`text-[11px] font-mono font-bold ${i === 0 ? 'text-blue' : 'text-ink-3'}`}>{i + 1}</span>
                <span className="font-sans font-bold text-[14px] text-ink truncate">{entry.name}</span>
                <span className="font-mono text-[14px] text-green font-bold">{entry.wins}</span>
                <span className="font-mono text-[14px] text-ink-3">{entry.losses}</span>
                <span className={`font-mono font-bold text-[13px] ${diff > 0 ? 'text-green' : diff < 0 ? 'text-red' : 'text-ink-3'}`}>
                  {diff > 0 ? `+${diff}` : diff}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Onglet Poules (cross-table) ────────────────────────────────────────────

interface PoolTeamEntry {
  key: string
  name: string
  wins: number
  losses: number
  ptWon: number
  ptLost: number
}

function computePoolTeamStandings(
  matches: Match[],
  allScores: Map<number, MatchScore[]>,
  allPlayerNames: Map<number, string>
): PoolTeamEntry[] {
  const map = new Map<string, PoolTeamEntry>()
  const ensure = (key: string): PoolTeamEntry => {
    if (!map.has(key)) map.set(key, { key, name: resolveTeam(key, allPlayerNames), wins: 0, losses: 0, ptWon: 0, ptLost: 0 })
    return map.get(key)!
  }
  for (const m of matches) {
    if (m.teamA) ensure(m.teamA)
    if (m.teamB) ensure(m.teamB)
    if ((m.status !== 'completed' && m.status !== 'walkover') || !m.teamA || !m.teamB || !m.winnerSide) continue
    const sets = allScores.get(m.id) ?? []
    const ptA = sets.reduce((s, x) => s + x.scoreA, 0)
    const ptB = sets.reduce((s, x) => s + x.scoreB, 0)
    const ea = ensure(m.teamA); const eb = ensure(m.teamB)
    ea.ptWon += ptA; ea.ptLost += ptB
    eb.ptWon += ptB; eb.ptLost += ptA
    if (m.winnerSide === 'A') { ea.wins++; eb.losses++ } else { eb.wins++; ea.losses++ }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    return (b.ptWon - b.ptLost) - (a.ptWon - a.ptLost)
  })
}

function PoolTable({
  name,
  matches,
  allScores,
  allPlayerNames,
}: {
  name: string
  matches: Match[]
  allScores: Map<number, MatchScore[]>
  allPlayerNames: Map<number, string>
}) {
  const standings = computePoolTeamStandings(matches, allScores, allPlayerNames)

  const findPoolMatch = (keyA: string, keyB: string): Match | undefined =>
    matches.find((m) => (m.teamA === keyA && m.teamB === keyB) || (m.teamA === keyB && m.teamB === keyA))

  const getCellScore = (match: Match, rowKey: string): string => {
    const isA = match.teamA === rowKey
    const sets = allScores.get(match.id) ?? []
    if (sets.length === 0) return 'ff'
    return sets.map((s) => (isA ? `${s.scoreA}-${s.scoreB}` : `${s.scoreB}-${s.scoreA}`)).join(' ')
  }

  const n = standings.length
  // gridTemplateColumns: # + nom + N colonnes adversaires + V + ±
  const cols = `24px 1fr ${Array(n).fill('52px').join(' ')} 40px 52px`

  return (
    <div className="border-2 border-line">
      <div className="px-4 py-2 bg-ink flex items-center gap-3">
        <span className="text-green-fluo font-mono text-[11px] font-bold uppercase tracking-[0.08em]">{name}</span>
        <span className="text-ink-3 font-mono text-[10px]">{n} équipes</span>
      </div>
      {/* En-tête colonnes */}
      <div className="border-b-2 border-line bg-bg-strong" style={{ display: 'grid', gridTemplateColumns: cols }}>
        <span className="px-2 py-2 text-[10px] font-mono font-bold text-ink-3">#</span>
        <span className="px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3">Joueur</span>
        {standings.map((_, i) => (
          <span key={i} className="py-2 text-[10px] font-mono font-bold text-ink-3 text-center">{i + 1}</span>
        ))}
        <span className="py-2 text-[10px] font-mono font-bold text-ink-3 text-center">V</span>
        <span className="py-2 text-[10px] font-mono font-bold text-ink-3 text-center">±</span>
      </div>
      {/* Lignes */}
      {standings.map((entry, rowIdx) => {
        const diff = entry.ptWon - entry.ptLost
        return (
          <div
            key={entry.key}
            className={`border-b border-line-soft ${rowIdx % 2 === 0 ? 'bg-bg' : 'bg-bg-alt'}`}
            style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'center' }}
          >
            <span className={`px-2 py-3 text-[11px] font-mono font-bold ${rowIdx === 0 ? 'text-blue' : 'text-ink-3'}`}>
              {rowIdx + 1}
            </span>
            <span className="px-3 py-3 font-sans font-bold text-[13px] text-ink truncate">{entry.name}</span>
            {standings.map((opponent, colIdx) => {
              if (rowIdx === colIdx) {
                return (
                  <span key={colIdx} className="py-3 text-[10px] font-mono text-ink-3 text-center bg-bg-strong">—</span>
                )
              }
              const match = findPoolMatch(entry.key, opponent.key)
              if (!match) {
                return <span key={colIdx} className="py-3 text-[10px] font-mono text-ink-3 text-center">—</span>
              }
              const score = getCellScore(match, entry.key)
              const won =
                (match.status === 'completed' || match.status === 'walkover') &&
                ((match.teamA === entry.key && match.winnerSide === 'A') ||
                  (match.teamB === entry.key && match.winnerSide === 'B'))
              return (
                <span
                  key={colIdx}
                  className={`py-3 text-[9px] font-mono font-bold text-center leading-tight block px-0.5
                    ${won ? 'text-green' : 'text-ink-3'}`}
                >
                  {score}
                </span>
              )
            })}
            <span className={`py-3 text-[13px] font-mono font-bold text-center ${entry.wins > 0 ? 'text-green' : 'text-ink-3'}`}>
              {entry.wins}
            </span>
            <span className={`py-3 text-[11px] font-mono font-bold text-center ${diff > 0 ? 'text-green' : diff < 0 ? 'text-red' : 'text-ink-3'}`}>
              {diff > 0 ? `+${diff}` : diff}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function PoolTab({
  matches,
  allScores,
  allPlayerNames,
  tournamentFormat,
}: {
  matches: Match[]
  allScores: Map<number, MatchScore[]>
  allPlayerNames: Map<number, string>
  tournamentFormat: string
}) {
  const isPoolKnockout = tournamentFormat === 'pool+knockout'

  const poolGroups = useMemo(() => {
    const groups = new Map<string, Match[]>()
    if (isPoolKnockout) {
      // Groupe par comment "Groupe X" (matchs de poules, rounds < 100)
      for (const m of matches) {
        if (!m.comment?.startsWith('Groupe')) continue
        if ((m.round ?? 0) >= 100) continue
        if (!groups.has(m.comment)) groups.set(m.comment, [])
        groups.get(m.comment)!.push(m)
      }
    } else {
      // Round-robin / americano : groupe par catégorie (ou un seul groupe si pas de cats)
      for (const m of matches) {
        const key = m.category ?? 'Général'
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(m)
      }
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [matches, isPoolKnockout])

  if (poolGroups.length === 0) {
    return (
      <p className="font-sans text-[14px] text-ink-3">
        {matches.length === 0
          ? 'Lancez le tournoi pour créer les matchs.'
          : 'Aucune poule disponible dans ce format.'}
      </p>
    )
  }

  // Libellé du groupe
  const groupLabel = (key: string): string => {
    if (key in CATEGORY_LABELS) return CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS]
    return key
  }

  return (
    <div className="flex flex-col gap-6">
      <div className={`grid gap-6 ${poolGroups.length > 1 ? 'grid-cols-2' : ''}`}>
        {poolGroups.map(([poolKey, poolMs]) => (
          <PoolTable
            key={poolKey}
            name={groupLabel(poolKey)}
            matches={poolMs}
            allScores={allScores}
            allPlayerNames={allPlayerNames}
          />
        ))}
      </div>
      {isPoolKnockout && (
        <p className="font-sans text-[12px] text-ink-3 border-l-2 border-line-soft pl-3">
          Phase finale — voir l'onglet Bracket. Tirage automatique en fin de poules.
        </p>
      )}
    </div>
  )
}

// ─── Carte joueur mini (bracket + doubles modal) ──────────────────────────────

function PlayerCardBracket({
  playerId,
  allPlayers,
  winner,
}: {
  playerId: number
  allPlayers: Map<number, Player>
  winner?: boolean
}) {
  const player = allPlayers.get(playerId)
  if (!player) return <span className="font-sans text-[12px] text-ink-3 italic">#{playerId}</span>
  const isH = player.gender === 'M'
  const initials = playerDisplayName(player).split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2)
  return (
    <div className="flex items-center gap-2 py-0.5">
      {/* Barre genre */}
      <div className="w-[2px] self-stretch shrink-0 min-h-[20px]"
        style={{ backgroundColor: isH ? '#0047FF' : '#00C24A' }} />
      {/* Initiales */}
      <div className="w-6 h-6 flex items-center justify-center font-mono font-black text-[9px] shrink-0"
        style={{ backgroundColor: isH ? '#0047FF' : '#0a0a0a', color: isH ? '#fff' : '#00FF66' }}>
        {initials}
      </div>
      {/* Nom */}
      <span className="font-sans font-bold text-[12px] truncate text-ink leading-tight">
        {playerDisplayName(player)}
      </span>
      {winner && (
        <span className="shrink-0 w-3 h-3 flex items-center justify-center"
          style={{ backgroundColor: '#00C24A' }}>
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
            <path d="M1 3L3 5L7 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="square"/>
          </svg>
        </span>
      )}
    </div>
  )
}

/** Résout une chaîne "123" ou "123,456" en une liste d'IDs joueurs */
function parseTeamIds(teamStr: string | undefined): number[] {
  if (!teamStr || teamStr === 'BYE') return []
  return teamStr.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
}

// ─── Onglet Bracket ───────────────────────────────────────────────────────────

function BracketTab({
  matches,
  allPlayerNames,
  allPlayers,
  tournamentFormat,
  courtCount,
  swapMode = false,
  swapSlot = null,
  onSwapSelect,
}: {
  matches: Match[]
  allPlayerNames: Map<number, string>
  allPlayers: Map<number, Player>
  tournamentFormat: string
  courtCount: number
  swapMode?: boolean
  swapSlot?: { matchId: number; side: 'A' | 'B' } | null
  onSwapSelect?: (matchId: number, side: 'A' | 'B') => void
}) {
  const isPoolKnockout = tournamentFormat === 'pool+knockout'

  const played     = matches.filter((m) => m.status === 'completed' || m.status === 'walkover').length
  const inProgress = matches.filter((m) => m.status === 'in_progress').length
  const upcoming   = matches.filter((m) => m.status === 'pending').length

  const byRound = useMemo(() => {
    const map = new Map<number, Match[]>()
    for (const m of matches) {
      const r = m.round ?? 1
      // Pour pool+knockout : n'afficher que la phase finale (rounds >= 100)
      if (isPoolKnockout && r < 100) continue
      if (!map.has(r)) map.set(r, [])
      map.get(r)!.push(m)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b)
  }, [matches, isPoolKnockout])

  // Labels knockout : compter depuis la fin
  const koLabels: Record<number, string> = {}
  byRound.forEach(([round], idx) => {
    const remaining = byRound.length - idx
    if (remaining === 1)      koLabels[round] = 'Finale'
    else if (remaining === 2) koLabels[round] = 'Demi-finales'
    else if (remaining === 3) koLabels[round] = 'Quarts de finale'
    else                      koLabels[round] = `Tour ${remaining - 3}`
  })

  // Labels pour les formats non-pool : compter depuis la fin sur tous les rounds
  const allLabels: Record<number, string> = {}
  if (!isPoolKnockout) {
    byRound.forEach(([round], idx) => {
      const remaining = byRound.length - idx
      if (remaining === 1)      allLabels[round] = 'Finale'
      else if (remaining === 2) allLabels[round] = 'Demi-finales'
      else if (remaining === 3) allLabels[round] = 'Quarts de finale'
      else                      allLabels[round] = `Tour ${round}`
    })
  }

  const getRoundLabel = (round: number): string => {
    if (!isPoolKnockout) return allLabels[round] ?? `Tour ${round}`
    return koLabels[round] ?? `Knockout T${round - 99}`
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stats Joués / En cours / À venir / Terrains */}
      <div className="flex gap-0 border-2 border-line w-fit">
        {[
          { label: 'Joués',    value: played,     clr: 'text-green' },
          { label: 'En cours', value: inProgress, clr: 'text-red' },
          { label: 'À venir',  value: upcoming,   clr: 'text-ink' },
          { label: 'Terrains', value: courtCount, clr: 'text-blue' },
        ].map(({ label, value, clr }, i) => (
          <div key={label} className={`px-5 py-3 flex flex-col items-center gap-0.5 ${i > 0 ? 'border-l-2 border-line' : ''}`}>
            <span className={`font-sans font-black text-[28px] tracking-[-0.03em] leading-none ${clr}`}>{value}</span>
            <span className="font-mono font-bold text-[10px] uppercase tracking-[0.08em] text-ink-3">{label}</span>
          </div>
        ))}
      </div>

      {byRound.length === 0 ? (
        <p className="font-sans text-[14px] text-ink-3">
          {isPoolKnockout
            ? 'Phase finale non encore démarrée. Lancez le bracket une fois les poules terminées.'
            : 'Aucun match de bracket disponible.'}
        </p>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-0 min-w-max">
            {byRound.map(([round, roundMatches]) => (
              <div key={round} className="flex flex-col min-w-[200px] border-r-2 border-line">
                <div className="px-4 py-2 bg-ink text-green-fluo text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-center">
                  {getRoundLabel(round)}
                </div>
                <div className="flex flex-col justify-around flex-1 py-4 gap-4 px-3">
                  {roundMatches.map((m) => {
                    const nameA = resolveTeam(m.teamA, allPlayerNames)
                    const nameB = resolveTeam(m.teamB, allPlayerNames)
                    const idsA = parseTeamIds(m.teamA)
                    const idsB = parseTeamIds(m.teamB)
                    const isBye = m.teamA === 'BYE' || m.teamB === 'BYE'
                    const isDone = m.status === 'completed' || m.status === 'walkover'
                    const isSelectedA = swapSlot?.matchId === m.id && swapSlot?.side === 'A'
                    const isSelectedB = swapSlot?.matchId === m.id && swapSlot?.side === 'B'

                    const sideClass = (isSelected: boolean) =>
                      swapMode && onSwapSelect
                        ? `cursor-pointer transition-colors ${isSelected ? 'bg-blue' : swapSlot ? 'hover:bg-blue/10 border-l-2 border-blue' : 'hover:bg-blue/5 border-l-2 border-dashed border-line-soft'}`
                        : ''

                    return (
                      <div key={m.id} className={`border-2 ${isDone ? 'border-green/40' : isSelectedA || isSelectedB ? 'border-blue' : 'border-line'}`}>
                        {/* Équipe A */}
                        <div
                          className={`px-3 py-2 border-b border-line-soft ${sideClass(isSelectedA)}`}
                          onClick={() => swapMode && onSwapSelect && onSwapSelect(m.id, 'A')}
                        >
                          {idsA.length > 0
                            ? <div className="flex flex-col gap-0.5">
                                {idsA.map((id) => (
                                  <PlayerCardBracket key={id} playerId={id} allPlayers={allPlayers} />
                                ))}
                              </div>
                            : <span className={`font-sans font-bold text-[12px] ${isSelectedA ? 'text-white' : m.teamA === 'BYE' ? 'text-ink-3 italic' : 'text-ink'}`}>
                                {nameA || '?'}
                              </span>
                          }
                        </div>
                        {/* Équipe B */}
                        <div
                          className={`px-3 py-2 ${isBye ? 'bg-bg-alt' : isDone ? 'bg-bg-alt' : 'bg-bg-alt'} ${sideClass(isSelectedB)}`}
                          onClick={() => swapMode && onSwapSelect && onSwapSelect(m.id, 'B')}
                        >
                          {idsB.length > 0
                            ? <div className="flex flex-col gap-0.5">
                                {idsB.map((id) => (
                                  <PlayerCardBracket key={id} playerId={id} allPlayers={allPlayers} />
                                ))}
                              </div>
                            : <span className={`font-sans font-bold text-[12px] ${isSelectedB ? 'text-white' : m.teamB === 'BYE' ? 'text-ink-3 italic' : 'text-ink'}`}>
                                {nameB || '?'}
                              </span>
                          }
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
      )}
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function TournamentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const tournamentId = Number(id)
  const isStandalone = searchParams.get('standalone') === '1'

  const { tournaments, updateTournament, fetchTournaments } = useTournamentsStore()
  const { players, fetchPlayers } = usePlayersStore()
  const { rules, fetchRules } = useRulesStore()

  const [tab, setTab] = useState<TabId>(() => {
    const param = searchParams.get('tab') as TabId | null
    return param && ['planning', 'standings', 'pools', 'bracket', 'players'].includes(param) ? param : 'planning'
  })
  const [matches, setMatches] = useState<Match[]>([])
  const [tournamentPlayers, setTournamentPlayers] = useState<number[]>([])
  const [tournamentPlayerRows, setTournamentPlayerRows] = useState<import('@/types/domain').TournamentPlayer[]>([])
  const [allScores, setAllScores] = useState<Map<number, MatchScore[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [confirming, setConfirming] = useState<'complete' | 'archive' | 'stop' | null>(null)
  // Swap mode : permet de réorganiser les matchs avant lancement (draft uniquement)
  const [swapSlot, setSwapSlot] = useState<{ matchId: number; side: 'A' | 'B' } | null>(null)
  const [swapMode, setSwapMode] = useState(false)

  // Initialise doublesTeams depuis le wizard (navigation state) ou vide
  const [doublesTeams, setDoublesTeams] = useState<PairMap>(() => {
    const wizardPairs = (location.state as { doublesTeams?: Partial<Record<MatchCategory, [number, number][]>> } | null)?.doublesTeams
    if (!wizardPairs) return new Map()
    const map = new Map<MatchCategory, [number, number][]>()
    for (const [cat, pairs] of Object.entries(wizardPairs)) {
      if (pairs) map.set(cat as MatchCategory, pairs)
    }
    return map
  })
  const [setupModalOpen, setSetupModalOpen] = useState(false)
  const [addMatchOpen, setAddMatchOpen] = useState(false)

  // Ref pour l'auto-génération depuis le wizard (via location.state)
  const handleGenerateRef = useRef<() => Promise<void>>(async () => {})
  const [autoGenerate] = useState(() => !!(location.state as { autoGenerate?: boolean })?.autoGenerate)
  const [wizardPoolAssignments] = useState<number[][] | undefined>(
    () => (location.state as { poolAssignments?: number[][] } | null)?.poolAssignments
  )
  const [wizardDoublesPoolAssignments] = useState<Partial<Record<MatchCategory, number[][]>> | undefined>(
    () => (location.state as { doublesPoolAssignments?: Partial<Record<MatchCategory, number[][]>> } | null)?.doublesPoolAssignments
  )
  const autoGenerateDone = useRef(false)

  // Indique que les stores ont été chargés au moins une fois (important pour la nouvelle fenêtre)
  const [storesFetched, setStoresFetched] = useState(false)

  const tournament = tournaments.find((t) => t.id === tournamentId)

  useEffect(() => {
    const loadAll = async () => {
      await Promise.all([fetchTournaments(), fetchPlayers(), fetchRules()])
      setStoresFetched(true)
    }
    void loadAll()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
        setTournamentPlayerRows(tp)
        setMatches(m)
        // Charge tous les scores en une seule requête (remplace N appels getMatchScores)
        const allScoresArr = await window.db.getAllMatchScores(tournamentId)
        const scoresMap = new Map<number, MatchScore[]>()
        for (const s of allScoresArr) {
          const arr = scoresMap.get(s.matchId) ?? []
          arr.push(s)
          scoresMap.set(s.matchId, arr)
        }
        setAllScores(scoresMap)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [tournamentId])

  // Auto-génére le planning si on vient du wizard (autoGenerate=true dans location.state)
  useEffect(() => {
    if (!autoGenerate || autoGenerateDone.current) return
    if (loading || !tournament) return
    if (matches.length > 0) { autoGenerateDone.current = true; return }
    if (tournamentPlayers.length < 2) return
    autoGenerateDone.current = true
    void handleGenerateRef.current()
  }, [autoGenerate, loading, tournament, matches.length, tournamentPlayers.length])

  // Ces deux hooks sont définis ICI, avant le guard if(!tournament), pour respecter
  // les Rules of Hooks (appel identique à chaque rendu, même quand tournament est undefined)
  const handleRefresh = useCallback(async () => {
    const freshMatches = await window.db.getMatches(tournamentId)
    setMatches(freshMatches)
    const allScoresArr = await window.db.getAllMatchScores(tournamentId)
    const scoresMap = new Map<number, MatchScore[]>()
    for (const s of allScoresArr) {
      const arr = scoresMap.get(s.matchId) ?? []
      arr.push(s)
      scoresMap.set(s.matchId, arr)
    }
    setAllScores(scoresMap)
  }, [tournamentId])

  // Polling auto-refresh : 3s si tournoi actif, 5s en standalone
  useEffect(() => {
    const shouldPoll = isStandalone || tournament?.status === 'active'
    if (!shouldPoll) return
    const interval = setInterval(() => { void handleRefresh() }, isStandalone ? 5000 : 3000)
    return () => clearInterval(interval)
  }, [isStandalone, tournament?.status, handleRefresh])

  if (!tournament) {
    if (!storesFetched) {
      return (
        <div className="p-8">
          <p className="font-sans text-[14px] text-ink-3">Chargement…</p>
        </div>
      )
    }
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
  const allPlayersMap = new Map(players.map((p) => [p.id, p]))
  const hasCats = tournament.categories.length > 0
  const allMatchesDone = matches.length > 0 && matches.every((m) => m.status === 'completed' || m.status === 'walkover')

  // Catégories doubles nécessitant une configuration de paires
  const doublesCategories = tournament.categories.filter((c) => DOUBLES_CATEGORIES.includes(c))
  const hasDoublesCats = doublesCategories.length > 0
  // En mode interclub les doubles sont auto-générés — pas de configuration de paires requise
  const pairsReady = tournament.teamMode === 1 || !hasDoublesCats || doublesCategories.every((cat) => {
    const pairs = doublesTeams.get(cat) ?? []
    return pairs.filter(([a, b]) => a > 0 && b > 0 && a !== b).length >= 1
  })

  // ─── Génération format-aware ───────────────────────────────────────────────
  const handleGenerate = async () => {
    if (generating || tournamentPlayers.length < 2) return
    setGenerateError(null)
    setGenerating(true)
    try {
      // ── Mode interclub : génération déléguée à generateInterclub ──────────
      if (tournament.teamMode === 1) {
        const cats = tournament.categories.length > 0 ? tournament.categories : ['SH' as MatchCategory]
        const simpleCats = cats.filter((c) => c === 'SH' || c === 'SD')
        const doublesCatsInterclub = cats.filter((c) => DOUBLES_CATEGORIES.includes(c))

        // Tri ELO décroissant via le store players (fallback 1000 si pas encore chargé)
        const sortByElo = (a: { playerId: number }, b: { playerId: number }) => {
          const eloA = players.find((pl) => pl.id === a.playerId)?.elo ?? 1000
          const eloB = players.find((pl) => pl.id === b.playerId)?.elo ?? 1000
          return eloB - eloA
        }

        // Construit les paires doubles pour une équipe et une catégorie
        const buildDoublesPairs = (
          rows: typeof tournamentPlayerRows,
          cat: MatchCategory
        ): [number, number][] => {
          const pairs: [number, number][] = []
          if (cat === 'DH') {
            const men = [...rows.filter((r) => r.gender === 'M')].sort(sortByElo)
            for (let i = 0; i + 1 < men.length; i += 2) pairs.push([men[i].playerId, men[i + 1].playerId])
          } else if (cat === 'DD') {
            const women = [...rows.filter((r) => r.gender === 'F')].sort(sortByElo)
            for (let i = 0; i + 1 < women.length; i += 2) pairs.push([women[i].playerId, women[i + 1].playerId])
          } else if (cat === 'DX') {
            const men = [...rows.filter((r) => r.gender === 'M')].sort(sortByElo)
            const women = [...rows.filter((r) => r.gender === 'F')].sort(sortByElo)
            const cnt = Math.min(men.length, women.length)
            for (let i = 0; i < cnt; i++) pairs.push([men[i].playerId, women[i].playerId])
          }
          return pairs
        }

        // Toutes les équipes présentes (A, B, C, D…) — round-robin entre chaque paire
        const allTeamSides = [...new Set(tournamentPlayerRows.map((r) => r.teamSide ?? 'A'))].sort()
        let courtCursor = 1
        let round = 0

        for (let ti = 0; ti < allTeamSides.length; ti++) {
          for (let tj = ti + 1; tj < allTeamSides.length; tj++) {
            round++
            const sideX = allTeamSides[ti]
            const sideY = allTeamSides[tj]
            const rowsX = tournamentPlayerRows.filter((r) => r.teamSide === sideX)
            const rowsY = tournamentPlayerRows.filter((r) => r.teamSide === sideY)

            // Singles
            for (const cat of simpleCats) {
              const gender = cat === 'SH' ? 'M' : 'F'
              const playersX = [...rowsX.filter((r) => r.gender === gender)].sort(sortByElo)
              const playersY = [...rowsY.filter((r) => r.gender === gender)].sort(sortByElo)
              const cnt = Math.min(playersX.length, playersY.length)
              for (let k = 0; k < cnt; k++) {
                await window.db.createMatch({
                  tournamentId,
                  round,
                  courtNumber: ((courtCursor - 1) % tournament.courtCount) + 1,
                  playerAId: playersX[k].playerId,
                  playerBId: playersY[k].playerId,
                  category: cat,
                })
                courtCursor++
              }
            }

            // Doubles
            for (const cat of doublesCatsInterclub) {
              const pairsX = buildDoublesPairs(rowsX, cat)
              const pairsY = buildDoublesPairs(rowsY, cat)
              const cnt = Math.min(pairsX.length, pairsY.length)
              for (let k = 0; k < cnt; k++) {
                await window.db.createMatchWithTeams({
                  tournamentId,
                  round,
                  courtNumber: ((courtCursor - 1) % tournament.courtCount) + 1,
                  teamAPlayerIds: [...pairsX[k]],
                  teamBPlayerIds: [...pairsY[k]],
                  category: cat,
                })
                courtCursor++
              }
            }
          }
        }

        const freshMatches = await window.db.getMatches(tournamentId)
        setMatches(freshMatches)
        if (freshMatches.length === 0) {
          setGenerateError('Aucun match généré. Vérifiez que les joueurs ont bien été assignés à des équipes.')
        }
        await updateTournament(tournamentId, { status: 'active' })
        return
      }

      const categoriesToGenerate: (MatchCategory | undefined)[] =
        tournament.categories.length > 0 ? tournament.categories : [undefined]

      // Collect les catégories ignorées pour avertissement final
      const skippedCategories: string[] = []
      const isKnockoutFormat = ['knockout', 'double-elimination'].includes(tournament.format)

      for (const category of categoriesToGenerate) {
        const isDoubles = category !== undefined && DOUBLES_CATEGORIES.includes(category)

        // ── Doubles : génération par paires ─────────────────────────────────
        if (isDoubles) {
          const pairs = doublesTeams.get(category) ?? []
          const validPairs = pairs.filter(([a, b]) => a > 0 && b > 0 && a !== b)
          if (validPairs.length < 1) {
            if (category) skippedCategories.push(category)
            continue
          }

          // Les générateurs travaillent avec des "indices" (fake IDs)
          const fakeIds = validPairs.map((_, i) => i)
          let generated: Omit<Match, 'id' | 'winnerId'>[] = []

          switch (tournament.format) {
            case 'round-robin':
              generated = generateRoundRobin(fakeIds, { tournamentId, courtCount: tournament.courtCount })
              break
            case 'knockout':
            case 'double-elimination':
              generated = generateSingleElim(fakeIds, tournamentId)
              break
            case 'pool+knockout': {
              // Pour les doubles, utilise les assignments de paires du wizard (indices 0,1,2…)
              // si disponibles et cohérents — sinon répartition automatique
              const poolCount = tournament.poolCount ?? 2
              let manualPools: number[][] | undefined
              if (wizardDoublesPoolAssignments && category) {
                const catAssignments = wizardDoublesPoolAssignments[category]
                if (
                  catAssignments &&
                  catAssignments.length === poolCount &&
                  catAssignments.every((pool) => pool.every((idx) => idx < validPairs.length))
                ) {
                  manualPools = catAssignments
                }
              }
              const result = generatePoolPlusKnockout(fakeIds, {
                tournamentId,
                courtCount: tournament.courtCount,
                poolCount,
                manualPools,
              })
              generated = [...result.poolMatches, ...result.knockoutMatches]
              break
            }
            case 'americano':
              generated = generateAmericano(fakeIds, { tournamentId, courtCount: tournament.courtCount })
              break
            default:
              generated = generateRoundRobin(fakeIds, { tournamentId, courtCount: tournament.courtCount })
          }

          // Matchs BYE en knockout doubles — track pour auto-avancement
          const byeAdvancesDoubles: { matchId: number; realPairIdx: number }[] = []

          for (const m of generated) {
            if (m.teamA && m.teamB && m.teamA !== 'BYE' && m.teamB !== 'BYE') {
              const idxA = parseInt(m.teamA, 10)
              const idxB = parseInt(m.teamB, 10)
              if (isNaN(idxA) || isNaN(idxB) || idxA >= validPairs.length || idxB >= validPairs.length) continue
              await window.db.createMatchWithTeams({
                tournamentId,
                round: m.round,
                courtNumber: m.courtNumber,
                teamAPlayerIds: [...validPairs[idxA]],
                teamBPlayerIds: [...validPairs[idxB]],
                category,
                comment: m.comment,
              })
            } else if (['knockout', 'double-elimination', 'pool+knockout'].includes(tournament.format)) {
              const created = await window.db.createPlaceholderMatch({ tournamentId, round: m.round, category, comment: m.comment })
              // Track les BYEs du premier tour pour auto-avancement
              if (isKnockoutFormat && m.round === 1 && (m.teamA === 'BYE' || m.teamB === 'BYE')) {
                const realIdx = m.teamA !== 'BYE' ? parseInt(m.teamA!, 10) : parseInt(m.teamB!, 10)
                if (!isNaN(realIdx) && realIdx < validPairs.length) {
                  byeAdvancesDoubles.push({ matchId: created.id, realPairIdx: realIdx })
                }
              }
            }
          }

          // Auto-avance les équipes doubles qui avaient un BYE
          for (const { matchId, realPairIdx } of byeAdvancesDoubles) {
            await window.db.updateMatchStatus(matchId, 'completed')
            // Avance via le premier joueur de la paire (advanceWinner trouve toute la paire via les participants)
            await window.db.advanceWinner(tournamentId, matchId, validPairs[realPairIdx][0])
          }

          // ── Joueurs orphelins (non appariés) → génère des matchs singles ─
          // Applicable uniquement en DX où le déséquilibre H/F laisse des orphelins
          if (category === 'DX') {
            const usedInPairs = new Set<number>(validPairs.flatMap(([a, b]) => [a, b]))
            const orphanMen   = tournamentPlayerRows.filter((r) => r.gender === 'M' && !usedInPairs.has(r.playerId)).map((r) => r.playerId)
            const orphanWomen = tournamentPlayerRows.filter((r) => r.gender === 'F' && !usedInPairs.has(r.playerId)).map((r) => r.playerId)

            if (orphanMen.length >= 2) {
              const shMatches = generateRoundRobin(orphanMen, { tournamentId, courtCount: tournament.courtCount })
              for (const om of shMatches) {
                if (!om.teamA || !om.teamB || om.teamA === 'BYE' || om.teamB === 'BYE') continue
                const pAId = parseInt(om.teamA, 10); const pBId = parseInt(om.teamB, 10)
                if (!isNaN(pAId) && !isNaN(pBId))
                  await window.db.createMatch({ tournamentId, round: om.round, courtNumber: om.courtNumber, playerAId: pAId, playerBId: pBId, category: 'SH' })
              }
            }
            if (orphanWomen.length >= 2) {
              const sdMatches = generateRoundRobin(orphanWomen, { tournamentId, courtCount: tournament.courtCount })
              for (const om of sdMatches) {
                if (!om.teamA || !om.teamB || om.teamA === 'BYE' || om.teamB === 'BYE') continue
                const pAId = parseInt(om.teamA, 10); const pBId = parseInt(om.teamB, 10)
                if (!isNaN(pAId) && !isNaN(pBId))
                  await window.db.createMatch({ tournamentId, round: om.round, courtNumber: om.courtNumber, playerAId: pAId, playerBId: pBId, category: 'SD' })
              }
            }
          }
        } else {
          // ── Singles : filtre de genre selon la catégorie ─────────────────
          let playerPool = [...tournamentPlayers]
          if (category === 'SH') {
            // Utilise tournamentPlayerRows (jointure SQL) pour éviter la race condition avec le store global players
            playerPool = tournamentPlayerRows.filter((r) => r.gender === 'M').map((r) => r.playerId)
          } else if (category === 'SD') {
            playerPool = tournamentPlayerRows.filter((r) => r.gender === 'F').map((r) => r.playerId)
          }
          if (playerPool.length < 2) {
            if (category) skippedCategories.push(`${category} (0 joueur éligible)`)
            continue
          }

          let generated: Omit<Match, 'id' | 'winnerId'>[] = []

          switch (tournament.format) {
            case 'round-robin':
              generated = generateRoundRobin(playerPool, { tournamentId, courtCount: tournament.courtCount })
              break
            case 'knockout':
            case 'double-elimination':
              generated = generateSingleElim(playerPool, tournamentId)
              break
            case 'pool+knockout': {
              // Filtre les pools manuels du wizard pour ne conserver que les joueurs
              // présents dans playerPool (ex : en SH on exclut les joueuses)
              const poolCount = tournament.poolCount ?? 2
              let filteredManualPools: number[][] | undefined
              if (wizardPoolAssignments) {
                const filtered = wizardPoolAssignments
                  .map((pool) => pool.filter((id) => playerPool.includes(id)))
                  .filter((pool) => pool.length >= 2)
                filteredManualPools = filtered.length === poolCount ? filtered : undefined
              }
              const result = generatePoolPlusKnockout(playerPool, {
                tournamentId,
                courtCount: tournament.courtCount,
                poolCount,
                manualPools: filteredManualPools,
              })
              generated = [...result.poolMatches, ...result.knockoutMatches]
              break
            }
            case 'americano':
              generated = generateAmericano(playerPool, { tournamentId, courtCount: tournament.courtCount })
              break
            default:
              generated = generateRoundRobin(playerPool, { tournamentId, courtCount: tournament.courtCount })
          }

          // Matchs BYE en knockout — track pour auto-avancement
          const byeAdvancesSingles: { matchId: number; realPlayerId: number }[] = []

          for (const m of generated) {
            if (m.teamA && m.teamB && m.teamA !== 'BYE' && m.teamB !== 'BYE') {
              const playerAId = parseInt(m.teamA, 10)
              const playerBId = parseInt(m.teamB, 10)
              if (isNaN(playerAId) || isNaN(playerBId)) continue
              await window.db.createMatch({ tournamentId, round: m.round, courtNumber: m.courtNumber, playerAId, playerBId, category, comment: m.comment })
            } else if (['knockout', 'double-elimination', 'pool+knockout'].includes(tournament.format)) {
              const created = await window.db.createPlaceholderMatch({ tournamentId, round: m.round, category, comment: m.comment })
              // Track les BYEs du premier tour pour auto-avancement
              if (isKnockoutFormat && m.round === 1 && (m.teamA === 'BYE' || m.teamB === 'BYE')) {
                const realId = m.teamA !== 'BYE' ? parseInt(m.teamA!, 10) : parseInt(m.teamB!, 10)
                if (!isNaN(realId)) byeAdvancesSingles.push({ matchId: created.id, realPlayerId: realId })
              }
            }
          }

          // Auto-avance les joueurs qui avaient un BYE
          for (const { matchId, realPlayerId } of byeAdvancesSingles) {
            await window.db.updateMatchStatus(matchId, 'completed')
            await window.db.advanceWinner(tournamentId, matchId, realPlayerId)
          }
        }
      }

      const freshMatches = await window.db.getMatches(tournamentId)
      setMatches(freshMatches)
      if (freshMatches.length === 0) {
        setGenerateError('Aucun match généré. Vérifiez que les joueurs sont inscrits et que les catégories correspondent aux genres disponibles.')
      } else if (skippedCategories.length > 0) {
        setGenerateError(`Attention : catégories ignorées (joueurs insuffisants) : ${skippedCategories.join(', ')}.`)
      }
      // La génération laisse le tournoi en DRAFT — l'utilisateur peut réorganiser puis confirmer
    } catch (err) {
      console.error('Erreur génération planning:', err)
      setGenerateError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
    }
  }

  // Met à jour le ref pour que l'useEffect d'auto-génération puisse appeler handleGenerate
  handleGenerateRef.current = handleGenerate
  const handleReset = async () => {
    setResetting(true)
    setSwapMode(false)
    setSwapSlot(null)
    try {
      await window.db.clearTournamentMatches(tournamentId)
      setMatches([])
    } finally {
      setResetting(false)
    }
  }

  // Confirme le lancement : passe le tournoi en actif
  const handleLaunch = async () => {
    await updateTournament(tournamentId, { status: 'active' })
    setSwapMode(false)
    setSwapSlot(null)
  }

  // Échange deux slots entre deux matchs (réorganisation)
  const handleSwap = async (m1: number, s1: 'A' | 'B', m2: number, s2: 'A' | 'B') => {
    await window.db.swapMatchSides(m1, s1, m2, s2)
    const freshMatches = await window.db.getMatches(tournamentId)
    setMatches(freshMatches)
  }

  const handleSwapPositions = async (m1: number, m2: number) => {
    await window.db.swapMatchPositions(m1, m2)
    const freshMatches = await window.db.getMatches(tournamentId)
    setMatches(freshMatches)
  }

  const handleComplete = async () => {
    await updateTournament(tournamentId, { status: 'completed' })
    setConfirming(null)
  }

  const handleArchive = async () => {
    await updateTournament(tournamentId, { status: 'archived' })
    setConfirming(null)
  }

  const handleStop = async () => {
    await updateTournament(tournamentId, { status: 'draft' })
    setConfirming(null)
  }

  // ─── Onglets ───────────────────────────────────────────────────────────────
  const isElimFormat = ['knockout', 'double-elimination', 'pool+knockout'].includes(tournament.format)
  const hasRoundRobinPhase = ['round-robin', 'americano', 'pool+knockout'].includes(tournament.format)

  const TABS: { id: TabId; label: string; icon: React.ElementType; show?: boolean }[] = [
    { id: 'planning',  label: 'Planning',   icon: List },
    { id: 'standings', label: 'Classement', icon: BarChart3 },
    { id: 'pools',     label: 'Poules',     icon: LayoutGrid, show: hasRoundRobinPhase },
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
            {tournament.teamMode === 1 && (() => {
              // teamNames (N équipes) en priorité, sinon repli sur teamAName/teamBName
              const names: string[] = tournament.teamNames && tournament.teamNames.length >= 2
                ? tournament.teamNames
                : [tournament.teamAName || 'Équipe A', tournament.teamBName || 'Équipe B']
              const COLORS = [
                { bg: '#0047FF', text: '#ffffff' },
                { bg: '#0a0a0a', text: '#00FF66' },
                { bg: '#D97500', text: '#ffffff' },
                { bg: '#E60022', text: '#ffffff' },
                { bg: '#00C24A', text: '#ffffff' },
                { bg: '#4a4a4a', text: '#ffffff' },
                { bg: '#6600cc', text: '#ffffff' },
                { bg: '#008080', text: '#ffffff' },
              ]
              return (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {names.map((n, idx) => (
                    <span key={idx}
                      className="px-3 py-1 font-mono font-bold text-[11px] uppercase tracking-[0.08em]"
                      style={{ backgroundColor: COLORS[idx % COLORS.length].bg, color: COLORS[idx % COLORS.length].text }}>
                      {n}
                    </span>
                  ))}
                </div>
              )
            })()}
          </div>

          {/* Actions selon statut */}
          <div className="flex gap-2 shrink-0 items-center flex-wrap">
            {/* Bouton doubles setup uniquement si NON interclub (interclub = auto-pairing) */}
            {tournament.status === 'draft' && hasDoublesCats && tournament.teamMode !== 1 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSetupModalOpen(true)}
              >
                <Users size={13} className="mr-1 inline" />
                {pairsReady ? 'Modifier les équipes' : 'Constituer les équipes doubles'}
              </Button>
            )}
            {/* Draft + aucun match : bouton "Générer le planning" */}
            {tournament.status === 'draft' && matches.length === 0 && (
              <>
                <Button
                  size="sm"
                  disabled={generating || tournamentPlayers.length < 2 || !pairsReady}
                  onClick={handleGenerate}
                  title={!pairsReady ? 'Configurez d\'abord les équipes doubles' : undefined}
                >
                  <Play size={13} className="mr-1 inline" />
                  {generating ? 'Génération…' : 'Générer le planning'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setAddMatchOpen(true)}>
                  <Plus size={13} className="mr-1 inline" />
                  Ajouter manuellement
                </Button>
              </>
            )}
            {generateError && (
              <span className="font-mono text-[11px] text-red font-bold">
                Erreur : {generateError}
              </span>
            )}
            {/* Draft + matchs générés : réorganiser, réinitialiser, ou confirmer */}
            {tournament.status === 'draft' && matches.length > 0 && (
              <>
                <button
                  onClick={() => { setSwapMode((v) => !v); setSwapSlot(null) }}
                  className={`flex items-center gap-1.5 px-3 py-2 border-2 min-h-[36px] font-mono font-bold text-[11px] uppercase tracking-[0.06em] transition-colors
                    ${swapMode ? 'bg-ink text-green-fluo border-ink' : 'bg-bg text-ink border-line hover:border-blue hover:text-blue'}`}
                >
                  {swapMode ? '✕ Quitter réorganisation' : '⇄ Réorganiser'}
                </button>
                <Button
                  variant="secondary" size="sm"
                  disabled={resetting}
                  onClick={handleReset}
                >
                  {resetting ? 'Réinit…' : '↺ Réinitialiser'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setAddMatchOpen(true)}>
                  <Plus size={13} className="mr-1 inline" />
                  Ajouter un match
                </Button>
                <Button
                  size="sm"
                  onClick={handleLaunch}
                >
                  <Play size={13} className="mr-1 inline" />
                  Lancer le tournoi
                </Button>
              </>
            )}
            {tournament.status === 'active' && confirming === null && (
              <>
                {allMatchesDone && (
                  <Button size="sm" onClick={() => setConfirming('complete')}>
                    <CheckCircle size={13} className="mr-1 inline" />
                    Clôturer
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => setConfirming('stop')}
                  title="Remettre en brouillon pour stopper le tournoi">
                  Arrêter le tournoi
                </Button>
              </>
            )}
            {tournament.status === 'active' && confirming === 'complete' && (
              <div className="flex gap-2 items-center">
                <span className="font-sans text-[13px] text-ink-3">Confirmer la clôture ?</span>
                <Button variant="secondary" size="sm" onClick={() => setConfirming(null)}>Annuler</Button>
                <Button size="sm" onClick={handleComplete}>Confirmer</Button>
              </div>
            )}
            {tournament.status === 'completed' && confirming === null && (
              <Button variant="secondary" size="sm" onClick={() => setConfirming('archive')}>
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
            {tournament.status === 'active' && confirming === 'stop' && (
              <div className="flex gap-2 items-center">
                <span className="font-sans text-[13px] text-warn">Remettre en brouillon ? Les matchs sont conservés.</span>
                <Button variant="secondary" size="sm" onClick={() => setConfirming(null)}>Annuler</Button>
                <Button variant="secondary" size="sm" onClick={handleStop}>Confirmer</Button>
              </div>
            )}
            {(tournament.status === 'completed' || tournament.status === 'archived' || tournament.status === 'active') && confirming === null && (
              <Button variant="secondary" size="sm" onClick={() => navigate(`/tournaments/${tournamentId}/print`)}>
                <Printer size={13} className="mr-1 inline" />
                Imprimer
              </Button>
            )}
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-0 -mb-px items-end">
          {TABS.filter((t) => t.show !== false).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-3 font-sans font-bold uppercase text-[12px]
                tracking-[0.05em] border-b-2 transition-colors
                ${tab === id ? 'text-ink border-blue' : 'text-ink-3 border-transparent hover:text-ink'}`}>
              <Icon size={13} />
              {label}
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  void window.db.openNewWindow(`/tournaments/${tournamentId}?tab=${id}&standalone=1`)
                }}
                title={`Ouvrir « ${label} » dans une nouvelle fenêtre`}
                className="ml-0.5 text-[9px] text-ink-3 hover:text-blue cursor-pointer transition-colors select-none"
              >↗</span>
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => { void handleRefresh() }}
            title="Rafraîchir les données"
            className="flex items-center gap-1.5 px-3 py-3 mb-px text-ink-3 hover:text-ink transition-colors border-b-2 border-transparent"
          >
            <RefreshCw size={13} />
            <span className="font-mono font-bold text-[10px] uppercase tracking-[0.08em]">Rafraîchir</span>
          </button>
        </div>
      </div>

      {/* Contenu onglet */}
      <div className="flex-1 overflow-y-auto scrollbar-light p-8">
        {/* Bandeau de réorganisation actif */}
        {swapMode && (
          <div className="mb-6 flex items-center gap-3 border-2 border-blue bg-bg px-4 py-3">
            <span className="font-mono font-bold text-[11px] uppercase tracking-[0.08em] text-blue">Mode réorganisation</span>
            <span className="font-sans text-[13px] text-ink-2">
              {swapSlot
                ? `Côté ${swapSlot.side} du match #${swapSlot.matchId} sélectionné — cliquez un autre emplacement pour échanger`
                : 'Cliquez un emplacement de joueur/équipe pour le sélectionner, puis cliquez un autre pour les échanger'}
            </span>
            {swapSlot && (
              <button className="ml-auto font-mono text-[11px] font-bold uppercase text-ink-3 hover:text-ink"
                onClick={() => setSwapSlot(null)}>Annuler</button>
            )}
          </div>
        )}
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
                allScores={allScores}
                rule={rule}
                tournamentFormat={tournament.format}
                onRefresh={() => { void handleRefresh() }}
                navigate={navigate}
                swapMode={swapMode && tournament.status === 'draft'}
                swapSlot={swapSlot}
                onSwapSelect={(matchId, side) => {
                  if (!swapSlot) {
                    setSwapSlot({ matchId, side })
                  } else {
                    void handleSwap(swapSlot.matchId, swapSlot.side, matchId, side)
                    setSwapSlot(null)
                  }
                }}
                onSwapPositions={(m1, m2) => { void handleSwapPositions(m1, m2) }}
                playerTeamMap={new Map(tournamentPlayerRows.map((r) => [r.playerId, r.teamSide ?? '']))}
                readOnly={tournament.status === 'draft'}
                onCourtChange={async (matchId, courtNumber) => {
                  await window.db.updateMatchCourtNumber(matchId, courtNumber)
                  void handleRefresh()
                }}
                courtCount={tournament.courtCount}
              />
            )}
            {tab === 'standings' && (
              <StandingsTab
                tournamentPlayers={tournamentPlayers}
                matches={matches}
                allScores={allScores}
                rule={rule}
                players={players}
                allPlayerNames={allPlayerNames}
              />
            )}
            {tab === 'pools' && (
              <PoolTab
                matches={matches}
                allScores={allScores}
                allPlayerNames={allPlayerNames}
                tournamentFormat={tournament.format}
              />
            )}
            {tab === 'bracket' && (
              <BracketTab
                matches={matches}
                allPlayerNames={allPlayerNames}
                allPlayers={allPlayersMap}
                tournamentFormat={tournament.format}
                courtCount={tournament.courtCount}
                swapMode={swapMode && tournament.status === 'draft'}
                swapSlot={swapSlot}
                onSwapSelect={(matchId, side) => {
                  if (!swapSlot) {
                    setSwapSlot({ matchId, side })
                  } else {
                    void handleSwap(swapSlot.matchId, swapSlot.side, matchId, side)
                    setSwapSlot(null)
                  }
                }}
              />
            )}
            {tab === 'players' && (
              <div className="flex flex-col border-2 border-line">
                <div className="grid grid-cols-[48px_140px_120px_120px_44px_120px_1fr_80px] bg-ink px-4 py-3">
                  {['N° Doss.', 'Nom', 'Prénom', 'Pseudo', 'G.', 'Niveau', 'Équipe', 'ELO'].map((h) => (
                    <span key={h} className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-green-fluo px-1">{h}</span>
                  ))}
                </div>
                {participantPlayers.length === 0 ? (
                  <p className="px-4 py-8 text-center font-sans text-[14px] text-ink-3">
                    Aucun joueur inscrit à ce tournoi
                  </p>
                ) : (
                  participantPlayers.map((p, i) => (
                    <div key={p.id}
                      className={`grid grid-cols-[48px_140px_120px_120px_44px_120px_1fr_80px] items-center px-4 py-3
                        border-b border-line-soft ${i % 2 === 0 ? 'bg-bg' : 'bg-bg-alt'}`}>
                      <span className="font-mono font-bold text-[13px] text-ink-3 px-1">
                        {p.playerNumber != null ? String(p.playerNumber).padStart(2, '0') : '—'}
                      </span>
                      <span className="font-sans font-black text-[14px] text-ink uppercase tracking-[-0.01em] px-1">
                        {p.lastName.toUpperCase()}
                      </span>
                      <span className="font-sans text-[14px] text-ink-2 px-1">{p.firstName}</span>
                      <span className="font-mono text-[12px] text-ink-3 truncate px-1">
                        {p.pseudo ? `"${p.pseudo}"` : <span className="text-ink-3/40">—</span>}
                      </span>
                      <Tag label={p.gender === 'M' ? 'H' : 'F'} color={p.gender === 'M' ? 'H' : 'F'} className="w-7 h-7 justify-center px-0 py-0" />
                      <span className="text-[11px] font-mono font-bold text-ink-2 uppercase px-1">{p.level}</span>
                      <span className="font-sans text-[12px] text-ink-2 truncate px-1">{p.club || '—'}</span>
                      <span className="font-mono text-[12px] text-ink-3 px-1">{p.elo ?? '—'}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal configuration équipes doubles */}
      {hasDoublesCats && (
        <DoublesSetupModal
          isOpen={setupModalOpen}
          onClose={() => setSetupModalOpen(false)}
          doublesCategories={doublesCategories}
          participantPlayers={participantPlayers}
          initialPairs={doublesTeams}
          onSave={(pairs) => setDoublesTeams(pairs)}
        />
      )}

      {/* Modal ajout manuel de match */}
      <AddMatchModal
        isOpen={addMatchOpen}
        onClose={() => setAddMatchOpen(false)}
        tournamentId={tournamentId}
        tournamentPlayerRows={tournamentPlayerRows}
        allPlayerNames={allPlayerNames}
        courtCount={tournament.courtCount}
        onCreated={() => { setAddMatchOpen(false); void handleRefresh() }}
      />
    </div>
  )
}
