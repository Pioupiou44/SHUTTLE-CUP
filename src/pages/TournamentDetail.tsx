import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useTournamentsStore } from '@/store/tournamentsStore'
import { usePlayersStore } from '@/store/playersStore'
import { useRulesStore } from '@/store/rulesStore'
import { Button, Badge, Modal, Tag } from '@/components/ui'
import { Play, ChevronLeft, Users, BarChart3, List, GitBranch, CheckCircle, Archive, Shuffle, Plus, X, Pencil, Radio, Printer, LayoutGrid } from 'lucide-react'
import { playerDisplayName, CATEGORY_LABELS } from '@/types/domain'
import { generateRoundRobin } from '@/engine/generators/roundRobin'
import { generateSingleElim } from '@/engine/generators/singleElim'
import { generateAmericano } from '@/engine/generators/americano'
import { generatePoolPlusKnockout } from '@/engine/generators/poolPlusKnockout'
import { generateInterclub } from '@/engine/generators/interclub'
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
      const winnerId = winnerSide === 'A' ? idA : winnerSide === 'B' ? idB : undefined
      const winnerIdSafe = winnerId !== undefined && !isNaN(winnerId) ? winnerId : undefined
      await window.db.updateMatchStatus(match.id, 'completed', winnerIdSafe)
      // Avance le bracket (round-robin : pas de next round, sans effet)
      if (winnerIdSafe) {
        await window.db.advanceWinner(match.tournamentId, match.id, winnerIdSafe)
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
      const winnerRawId = forfeitSide === 'A' ? idB : idA
      const winnerIdSafe = !isNaN(winnerRawId) ? winnerRawId : undefined
      await window.db.updateMatchStatus(match.id, 'walkover', winnerIdSafe)
      if (winnerIdSafe) {
        await window.db.advanceWinner(match.tournamentId, match.id, winnerIdSafe)
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
}) {
  const [filterCat, setFilterCat] = useState<MatchCategory | 'all'>('all')
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [seeding, setSeeding] = useState(false)

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

  // Calcule les classements par groupe et insère les participants dans le knockout
  const handleSeedKnockout = async () => {
    if (!rule || seeding) return
    setSeeding(true)
    try {
      const seeds: { matchId: number; side: 'A' | 'B'; playerIds: number[]; tournamentId: number }[] = []
      const poolMatches = matches.filter((m) => (m.round ?? 0) < 100)
      const presentCats = Array.from(new Set(poolMatches.map((m) => m.category).filter(Boolean))) as MatchCategory[]
      const rangeCategories: (MatchCategory | undefined)[] = presentCats.length > 0 ? presentCats : [undefined]

      for (const cat of rangeCategories) {
        const catPool = cat ? poolMatches.filter((m) => m.category === cat) : poolMatches
        const groupA = catPool.filter((m) => m.comment === 'Groupe A')
        const groupB = catPool.filter((m) => m.comment === 'Groupe B')

        // Classe les équipes d'un groupe par nombre de victoires
        const rankTeams = (groupMatches: Match[]) => {
          const teams = new Set<string>()
          for (const m of groupMatches) {
            if (m.teamA) teams.add(m.teamA)
            if (m.teamB) teams.add(m.teamB)
          }
          const wins = new Map<string, number>()
          for (const team of teams) wins.set(team, 0)
          for (const m of groupMatches) {
            if (m.status !== 'completed' && m.status !== 'walkover') continue
            const ms = allScores.get(m.id) ?? []
            const result = computeMatchResult(ms, rule)
            if (!result.winner) continue
            const winner = result.winner === 'A' ? m.teamA : m.teamB
            if (winner) wins.set(winner, (wins.get(winner) ?? 0) + 1)
          }
          return Array.from(teams)
            .map((t) => ({ team: t, wins: wins.get(t) ?? 0 }))
            .sort((a, b) => b.wins - a.wins)
        }

        const teamsA = rankTeams(groupA)
        const teamsB = rankTeams(groupB)
        if (teamsA.length === 0 || teamsB.length === 0) continue

        const ko1 = matches
          .filter((m) => m.round === 101 && (cat ? m.category === cat : true))
          .sort((a, b) => a.id - b.id)
        if (ko1.length === 0) continue

        const parseIds = (team: string) => team.split(',').map(Number).filter((n) => !isNaN(n) && n > 0)

        if (ko1.length === 1) {
          // Finale directe (2 qualifiants au total)
          seeds.push({ matchId: ko1[0].id, side: 'A', playerIds: parseIds(teamsA[0].team), tournamentId })
          seeds.push({ matchId: ko1[0].id, side: 'B', playerIds: parseIds(teamsB[0].team), tournamentId })
        } else {
          // Cross-seeding : A1 vs B2, B1 vs A2
          const b2 = teamsB[1] ?? teamsB[0]
          const a2 = teamsA[1] ?? teamsA[0]
          seeds.push({ matchId: ko1[0].id, side: 'A', playerIds: parseIds(teamsA[0].team), tournamentId })
          seeds.push({ matchId: ko1[0].id, side: 'B', playerIds: parseIds(b2.team), tournamentId })
          seeds.push({ matchId: ko1[1].id, side: 'A', playerIds: parseIds(teamsB[0].team), tournamentId })
          seeds.push({ matchId: ko1[1].id, side: 'B', playerIds: parseIds(a2.team), tournamentId })
        }
      }

      if (seeds.length > 0) {
        await window.db.seedKnockoutMatches(seeds)
        onRefresh()
      }
    } finally {
      setSeeding(false)
    }
  }

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
            <p className="font-sans text-[13px] text-ink-2 mt-0.5">Les matchs knockout peuvent maintenant être générés depuis les classements.</p>
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

                const teamCell = (side: 'A' | 'B', label: string, isWin: boolean, isSelected: boolean) => {
                  if (swapMode && onSwapSelect) {
                    return (
                      <button
                        className={`font-sans font-bold text-[14px] text-left px-1 border-2 transition-colors
                          ${isSelected
                            ? 'border-blue bg-blue text-white'
                            : swapSlot
                              ? 'border-blue text-ink hover:bg-blue/10 cursor-pointer'
                              : 'border-dashed border-line-soft text-ink hover:border-blue hover:bg-blue/5 cursor-pointer'}`}
                        onClick={(e) => { e.stopPropagation(); onSwapSelect(m.id, side) }}
                      >
                        {label}
                      </button>
                    )
                  }
                  return (
                    <span className={`font-sans font-bold text-[14px] ${isWin ? 'text-green' : isDone ? 'text-ink-3' : 'text-ink'}`}>
                      {label}
                      {isWin && <span className="ml-2 font-mono font-bold text-[10px] text-green uppercase tracking-[0.06em]">▲ Gagnant</span>}
                    </span>
                  )
                }

                return (
                  <div key={m.id}
                    className={`grid ${colsHeader} items-center px-4 py-3
                      border-b border-line-soft transition-colors
                      ${swapMode ? '' : 'hover:bg-bg-strong cursor-pointer'}
                      ${i % 2 === 0 ? 'bg-bg' : 'bg-bg-alt'}
                      ${isSelectedA || isSelectedB ? 'ring-2 ring-inset ring-blue' : ''}`}
                    onClick={() => { if (!swapMode) setSelectedMatch(m) }}
                  >
                    {teamCell('A', resolveTeam(m.teamA, allPlayerNames), isWinA, isSelectedA)}
                    {teamCell('B', resolveTeam(m.teamB, allPlayerNames), isWinB, isSelectedB)}
                    {/* Score compact */}
                    <span className={`font-mono font-bold text-[13px] tracking-[0.04em]
                      ${isDone ? 'text-ink' : 'text-ink-3'}`}>
                      {isDone && scoreStr ? scoreStr : m.status === 'walkover' ? 'Forfait' : '—'}
                    </span>
                    <span className="text-[11px] font-mono text-ink-3">
                      {m.courtNumber != null ? `T${m.courtNumber}` : '—'}
                    </span>
                    {hasCats && (
                      <span className="text-[11px] font-mono font-bold text-ink">
                        {m.category ?? '—'}
                      </span>
                    )}
                    {/* Statut + boutons d'action (masqués en mode réorganisation) */}
                    <div className="flex items-center gap-2">
                      {!swapMode && (
                        <>
                          <Badge variant={MATCH_STATUS_BADGE[m.status] ?? 'default'}>
                            {MATCH_STATUS_LABELS[m.status] ?? m.status}
                          </Badge>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/tournaments/${tournamentId}/match/${m.id}`)
                            }}
                            title="Ouvrir le mode arbitre"
                            className="p-1.5 text-ink-3 hover:text-blue transition-colors shrink-0"
                          >
                            <Radio size={13} />
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
}: {
  matches: Match[]
  allScores: Map<number, MatchScore[]>
  allPlayerNames: Map<number, string>
}) {
  const poolGroups = useMemo(() => {
    const groups = new Map<string, Match[]>()
    for (const m of matches) {
      if (!m.comment?.startsWith('Groupe')) continue
      if ((m.round ?? 0) >= 100) continue
      if (!groups.has(m.comment)) groups.set(m.comment, [])
      groups.get(m.comment)!.push(m)
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [matches])

  if (poolGroups.length === 0) {
    return (
      <p className="font-sans text-[14px] text-ink-3">
        Aucune poule générée. Lancez le tournoi pour créer les matchs.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className={`grid gap-6 ${poolGroups.length > 1 ? 'grid-cols-2' : ''}`}>
        {poolGroups.map(([poolName, poolMs]) => (
          <PoolTable
            key={poolName}
            name={poolName}
            matches={poolMs}
            allScores={allScores}
            allPlayerNames={allPlayerNames}
          />
        ))}
      </div>
      <p className="font-sans text-[12px] text-ink-3 border-l-2 border-line-soft pl-3">
        Phase finale — voir l'onglet Bracket. Tirage automatique en fin de poules.
      </p>
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
  const tournamentId = Number(id)

  const { tournaments, updateTournament, fetchTournaments } = useTournamentsStore()
  const { players, fetchPlayers } = usePlayersStore()
  const { rules, fetchRules } = useRulesStore()

  const [tab, setTab] = useState<TabId>('planning')
  const [matches, setMatches] = useState<Match[]>([])
  const [tournamentPlayers, setTournamentPlayers] = useState<number[]>([])
  const [tournamentPlayerRows, setTournamentPlayerRows] = useState<import('@/types/domain').TournamentPlayer[]>([])
  const [allScores, setAllScores] = useState<Map<number, MatchScore[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
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
        setTournamentPlayerRows(tp)
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
  const allPlayersMap = new Map(players.map((p) => [p.id, p]))
  const hasCats = tournament.categories.length > 0
  const allMatchesDone = matches.length > 0 && matches.every((m) => m.status === 'completed' || m.status === 'walkover')

  // Catégories doubles nécessitant une configuration de paires
  const doublesCategories = tournament.categories.filter((c) => DOUBLES_CATEGORIES.includes(c))
  const hasDoublesCats = doublesCategories.length > 0
  const pairsReady = !hasDoublesCats || doublesCategories.every((cat) => {
    const pairs = doublesTeams.get(cat) ?? []
    return pairs.filter(([a, b]) => a > 0 && b > 0 && a !== b).length >= 2
  })

  // ─── Génération format-aware ───────────────────────────────────────────────
  const handleGenerate = async () => {
    if (generating || tournamentPlayers.length < 2) return
    setGenerating(true)
    try {
      // ── Mode interclub : génération déléguée à generateInterclub ──────────
      if (tournament.teamMode === 1) {
        const interclubPlayers = tournamentPlayerRows.map((tp) => {
          const p = players.find((pl) => pl.id === tp.playerId)
          return {
            id: tp.playerId,
            gender: (p?.gender ?? 'M') as 'M' | 'F' | 'X',
            elo: p?.elo,
            teamSide: (tp.teamSide ?? 'A') as 'A' | 'B',
          }
        })
        const cats = tournament.categories.length > 0 ? tournament.categories : ['SH' as MatchCategory]
        const generated = generateInterclub(interclubPlayers, cats, tournamentId, tournament.courtCount)
        for (const m of generated) {
          const playerAId = parseInt(m.teamA!, 10)
          const playerBId = parseInt(m.teamB!, 10)
          if (isNaN(playerAId) || isNaN(playerBId)) continue
          await window.db.createMatch({
            tournamentId,
            round: m.round,
            courtNumber: m.courtNumber,
            playerAId,
            playerBId,
            category: m.category,
          })
        }
        const freshMatches = await window.db.getMatches(tournamentId)
        setMatches(freshMatches)
        await updateTournament(tournamentId, { status: 'active' })
        return
      }

      const categoriesToGenerate: (MatchCategory | undefined)[] =
        tournament.categories.length > 0 ? tournament.categories : [undefined]

      for (const category of categoriesToGenerate) {
        const isDoubles = category !== undefined && DOUBLES_CATEGORIES.includes(category)

        // ── Doubles : génération par paires ─────────────────────────────────
        if (isDoubles) {
          const pairs = doublesTeams.get(category) ?? []
          const validPairs = pairs.filter(([a, b]) => a > 0 && b > 0 && a !== b)
          if (validPairs.length < 2) continue

          // Les générateurs travaillent avec des "indices" (fake IDs)
          const fakeIds = validPairs.map((_, i) => i)
          let generated: Omit<Match, 'id' | 'winnerId' | 'comment'>[] = []

          switch (tournament.format) {
            case 'round-robin':
              generated = generateRoundRobin(fakeIds, { tournamentId, courtCount: tournament.courtCount })
              break
            case 'knockout':
            case 'double-elimination':
              generated = generateSingleElim(fakeIds, tournamentId)
              break
            case 'pool+knockout': {
              const result = generatePoolPlusKnockout(fakeIds, { tournamentId, courtCount: tournament.courtCount, poolCount: 2 })
              generated = [...result.poolMatches, ...result.knockoutMatches]
              break
            }
            case 'americano':
              generated = generateAmericano(fakeIds, { tournamentId, courtCount: tournament.courtCount })
              break
            default:
              generated = generateRoundRobin(fakeIds, { tournamentId, courtCount: tournament.courtCount })
          }

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
              })
            } else if (['knockout', 'double-elimination', 'pool+knockout'].includes(tournament.format)) {
              await window.db.createPlaceholderMatch({ tournamentId, round: m.round, category })
            }
          }
        } else {
          // ── Singles : filtre de genre selon la catégorie ─────────────────
          let playerPool = [...tournamentPlayers]
          if (category === 'SH') {
            playerPool = tournamentPlayers.filter((id) => players.find((p) => p.id === id)?.gender === 'M')
          } else if (category === 'SD') {
            playerPool = tournamentPlayers.filter((id) => players.find((p) => p.id === id)?.gender === 'F')
          }
          if (playerPool.length < 2) continue

          let generated: Omit<Match, 'id' | 'winnerId' | 'comment'>[] = []

          switch (tournament.format) {
            case 'round-robin':
              generated = generateRoundRobin(playerPool, { tournamentId, courtCount: tournament.courtCount })
              break
            case 'knockout':
            case 'double-elimination':
              generated = generateSingleElim(playerPool, tournamentId)
              break
            case 'pool+knockout': {
              const result = generatePoolPlusKnockout(playerPool, { tournamentId, courtCount: tournament.courtCount, poolCount: 2 })
              generated = [...result.poolMatches, ...result.knockoutMatches]
              break
            }
            case 'americano':
              generated = generateAmericano(playerPool, { tournamentId, courtCount: tournament.courtCount })
              break
            default:
              generated = generateRoundRobin(playerPool, { tournamentId, courtCount: tournament.courtCount })
          }

          for (const m of generated) {
            if (m.teamA && m.teamB && m.teamA !== 'BYE' && m.teamB !== 'BYE') {
              const playerAId = parseInt(m.teamA, 10)
              const playerBId = parseInt(m.teamB, 10)
              if (isNaN(playerAId) || isNaN(playerBId)) continue
              await window.db.createMatch({ tournamentId, round: m.round, courtNumber: m.courtNumber, playerAId, playerBId, category })
            } else if (['knockout', 'double-elimination', 'pool+knockout'].includes(tournament.format)) {
              await window.db.createPlaceholderMatch({ tournamentId, round: m.round, category })
            }
          }
        }
      }

      const freshMatches = await window.db.getMatches(tournamentId)
      setMatches(freshMatches)
      // La génération laisse le tournoi en DRAFT — l'utilisateur peut réorganiser puis confirmer
    } finally {
      setGenerating(false)
    }
  }

  // Supprime tous les matchs générés (réinitialisation avant re-génération)
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

  // Recharge les matchs et scores après une modification de score depuis le planning
  const handleRefresh = useCallback(async () => {
    const [freshMatches] = await Promise.all([window.db.getMatches(tournamentId)])
    setMatches(freshMatches)
    const scoresMap = new Map<number, MatchScore[]>()
    await Promise.all(freshMatches.map(async (m) => {
      const s = await window.db.getMatchScores(m.id)
      scoresMap.set(m.id, s)
    }))
    setAllScores(scoresMap)
  }, [tournamentId])

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

  const TABS: { id: TabId; label: string; icon: React.ElementType; show?: boolean }[] = [
    { id: 'planning',  label: 'Planning',   icon: List },
    { id: 'standings', label: 'Classement', icon: BarChart3 },
    { id: 'pools',     label: 'Poules',     icon: LayoutGrid, show: tournament.format === 'pool+knockout' },
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
            {tournament.status === 'draft' && hasDoublesCats && (
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
              <Button
                size="sm"
                disabled={generating || tournamentPlayers.length < 2 || !pairsReady}
                onClick={handleGenerate}
                title={!pairsReady ? 'Configurez d\'abord les équipes doubles' : undefined}
              >
                <Play size={13} className="mr-1 inline" />
                {generating ? 'Génération…' : 'Générer le planning'}
              </Button>
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
            {tab === 'pools' && (
              <PoolTab
                matches={matches}
                allScores={allScores}
                allPlayerNames={allPlayerNames}
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
    </div>
  )
}
