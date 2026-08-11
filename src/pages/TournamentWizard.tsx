import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTournamentsStore } from '@/store/tournamentsStore'
import { usePlayersStore } from '@/store/playersStore'
import { useRulesStore } from '@/store/rulesStore'
import { Button, Input, Tag, Badge } from '@/components/ui'
import { ChevronRight, ChevronLeft, Users, Trophy, Settings, AlignLeft, Shield, ChevronUp, ChevronDown, ChevronsUpDown, Shuffle, Plus, X, Layers2, LayoutGrid } from 'lucide-react'
import { playerDisplayName, FORMAT_LABELS, CATEGORY_LABELS } from '@/types/domain'
import { countRoundRobinMatches } from '@/engine/generators/roundRobin'
import { splitIntoPools } from '@/engine/generators/poolPlusKnockout'
import { nextPowerOf2 } from '@/engine/generators/singleElim'
import type { TournamentFormat, MatchCategory, Player, ScoringRule } from '@/types/domain'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WizardData {
  // Étape 1 — Infos
  name: string
  date: string
  location: string
  courtCount: number
  // Étape 3 — Équipes
  teamMode: boolean
  teamNames: string[]          // noms des équipes [idx] → lettre 'A'+idx
  // Étape 2 — Joueurs
  selectedPlayerIds: number[]
  // Étape 3 — Équipes : assignation
  teamAssignments: Record<number, string>  // playerId -> lettre d'équipe ('A','B','C'...)
  // Étape 4 — Format
  format: TournamentFormat
  categories: MatchCategory[]
  poolCount: number
  // Étape 5 — Règles
  scoringRuleId: number | null
  // Étape 6/7 — Poules (pool+knockout uniquement)
  poolAssignments: number[][]                                     // joueurs (singles)
  doublesPoolAssignments: Partial<Record<MatchCategory, number[][]>> // indices de paires (doubles)
  // Étape 7 — Composition doubles
  doublesTeams: Partial<Record<MatchCategory, [number, number][]>>
}

const INITIAL: WizardData = {
  name: '',
  date: new Date().toISOString().slice(0, 10),
  location: '',
  courtCount: 2,
  teamMode: false,
  teamNames: ['Équipe A', 'Équipe B'],
  selectedPlayerIds: [],
  teamAssignments: {},
  format: 'pool+knockout',
  categories: [],
  poolCount: 2,
  scoringRuleId: null,
  poolAssignments: [],
  doublesPoolAssignments: {},
  doublesTeams: {},
}

const DOUBLES_CATS: MatchCategory[] = ['DH', 'DD', 'DX']

const FORMAT_STEPS: Partial<Record<TournamentFormat, string[]>> = {
  'pool+knockout': [
    'Phase de poules : chaque joueur joue contre tous les autres dans son groupe',
    'Une fois tous les matchs de poules terminés, cliquer "Lancer le bracket"',
    'Le tableau final (demi-finales, finale…) est généré automatiquement selon le classement',
    'Les gagnants avancent automatiquement jusqu’à la finale',
  ],
  'round-robin': [
    'Tous les matchs sont générés en une seule fois dès le départ',
    'Chaque joueur joue contre tous les autres une fois',
    'Le classement final est établi par points (victoire = 2 pts, défaite = 1 pt)',
    'Pas de phase éliminatoire — le vainqueur est celui avec le plus de points',
  ],
  'knockout': [
    'Le tableau est généré en une seule fois (puissances de 2, BYE si impair)',
    'Le perdant de chaque match est éliminé, le gagnant avance automatiquement',
    'La progression continue jusqu’à la finale',
  ],
  'americano': [
    'Les partenaires et adversaires changent à chaque ronde',
    'L’appéariement se fait selon les scores cumulatifs',
    'Adapté en doubles (DH, DD, DX) pour un maximum de variété',
  ],
}

const FORMAT_OPTIONS: { value: TournamentFormat; label: string; disabled?: boolean }[] = [
  { value: 'pool+knockout',      label: 'Poules + Finale (recommandé)' },
  { value: 'round-robin',        label: 'Poules uniquement — Round Robin' },
  { value: 'knockout',           label: 'Élimination directe' },
  { value: 'double-elimination', label: 'Double élimination' },
  { value: 'americano',          label: 'Américano' },
  { value: 'swiss',              label: 'Système suisse' },
  { value: 'king-of-court',      label: 'Roi du court' },
]

type TournamentModelDef = {
  id: string
  label: string
  description: string
  format: TournamentFormat
  categories: MatchCategory[]
  poolCount: number
  scoringRuleNames: string[]
}

const TOURNAMENT_MODELS: TournamentModelDef[] = [
  {
    id: 'club-rapide',
    label: 'Tournoi club rapide',
    description: 'Format court pour soirée club : rounds fluides et score 2×15.',
    format: 'round-robin',
    categories: ['SH', 'SD'],
    poolCount: 2,
    scoringRuleNames: ['Format club 2×15 (rapide)', 'BWF 3×15 (à partir de 2027)'],
  },
  {
    id: 'officiel-bwf',
    label: 'Championnat officiel',
    description: 'Structure poules + finale avec règle BWF officielle.',
    format: 'pool+knockout',
    categories: ['SH', 'SD', 'DH', 'DD', 'DX'],
    poolCount: 2,
    scoringRuleNames: ['BWF 3×15 (à partir de 2027)', 'BWF Standard 3×21'],
  },
  {
    id: 'poules-finale',
    label: 'Poules + finale club',
    description: 'Chaque joueur joue plusieurs matchs avant la phase finale.',
    format: 'pool+knockout',
    categories: ['SH', 'SD', 'DH'],
    poolCount: 2,
    scoringRuleNames: ['BWF Standard 3×21', 'Set unique 21 points'],
  },
  {
    id: 'open-mixte',
    label: 'Format simple / double / mixte',
    description: 'Modèle polyvalent pour tournoi multi-disciplines.',
    format: 'americano',
    categories: ['DH', 'DD', 'DX'],
    poolCount: 2,
    scoringRuleNames: ['Set unique 15 points', 'Set unique 21 points'],
  },
]

const BASE_STEPS = [
  { id: 1, label: 'Infos',       icon: AlignLeft },
  { id: 2, label: 'Joueurs',     icon: Users },
  { id: 3, label: 'Équipes',     icon: Shield },
  { id: 4, label: 'Format',      icon: Trophy },
  { id: 5, label: 'Règles',      icon: Settings },
  { id: 7, label: 'Composition', icon: Layers2 },    // Composition avant Poules pour les doubles
  { id: 6, label: 'Poules',      icon: LayoutGrid },
]

// ─── Couleurs des équipes (style inline car count dynamique) ─────────────────

const TEAM_COLORS: { bg: string; text: string }[] = [
  { bg: '#0047FF', text: '#ffffff' },   // A — bleu
  { bg: '#0a0a0a', text: '#00FF66' },   // B — ink / vert-fluo
  { bg: '#D97500', text: '#ffffff' },   // C — warn
  { bg: '#E60022', text: '#ffffff' },   // D — red
  { bg: '#00C24A', text: '#ffffff' },   // E — vert
  { bg: '#4a4a4a', text: '#ffffff' },   // F — gris foncé
  { bg: '#6600cc', text: '#ffffff' },   // G — violet
  { bg: '#008080', text: '#ffffff' },   // H — teal
]

// ─── Aperçu live (côté droit) ─────────────────────────────────────────────────

/** Formate une durée en minutes en "~Xh" ou "~XhYY" */
function fmtDuration(minutes: number): string {
  if (minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `~${m} min`
  return m === 0 ? `~${h}h` : `~${h}h${String(m).padStart(2, '0')}`
}

function TournamentPreview({ data, selectedPlayers, selectedRule }: {
  data: WizardData
  selectedPlayers: Player[]
  selectedRule: ScoringRule | undefined
}) {
  const n = selectedPlayers.length
  const courts = data.courtCount
  const maleCount = selectedPlayers.filter((p) => p.gender === 'M').length
  const femaleCount = selectedPlayers.filter((p) => p.gender === 'F').length

  // ── Calcul simulation ────────────────────────────────────────────────────
  type SimResult = { headline: string; detail: string; duration: string }

  const simulate = (): SimResult | null => {
    if (n < 2) return null

    if (data.format === 'round-robin') {
      const total = countRoundRobinMatches(n)
      const rounds = n % 2 === 0 ? n - 1 : n
      const dur = Math.ceil(total / courts) * 20
      return {
        headline: `${n} joueurs · ${rounds} rondes`,
        detail: `→ ${total} matchs total`,
        duration: `${fmtDuration(dur)} sur ${courts} terrain${courts > 1 ? 's' : ''}`,
      }
    }

    if (data.format === 'knockout') {
      const size = nextPowerOf2(n)
      const total = size - 1
      const byes = size - n
      const dur = Math.ceil(total / courts) * 20
      return {
        headline: `Bracket ${size} · ${byes} bye${byes !== 1 ? 's' : ''}`,
        detail: `→ ${total} matchs total`,
        duration: `${fmtDuration(dur)} sur ${courts} terrain${courts > 1 ? 's' : ''}`,
      }
    }

    if (data.format === 'double-elimination') {
      const size = nextPowerOf2(n)
      const total = size * 2 - 1
      const dur = Math.ceil(total / courts) * 20
      return {
        headline: `Double élimination · bracket ${size}`,
        detail: `→ ${total} matchs max`,
        duration: `${fmtDuration(dur)} sur ${courts} terrain${courts > 1 ? 's' : ''}`,
      }
    }

    if (data.format === 'pool+knockout') {
      const poolSize = Math.ceil(n / data.poolCount)
      const poolMatchesPerGroup = (poolSize * (poolSize - 1)) / 2
      const poolTotal = data.poolCount * poolMatchesPerGroup
      const finalSize = nextPowerOf2(data.poolCount * 2)
      const koTotal = finalSize - 1
      const total = poolTotal + koTotal
      const dur = Math.ceil(total / courts) * 20
      return {
        headline: `${data.poolCount} poules de ${poolSize} · finale à ${finalSize}`,
        detail: `→ ${total} matchs total`,
        duration: `${fmtDuration(dur)} sur ${courts} terrain${courts > 1 ? 's' : ''}`,
      }
    }

    if (data.format === 'americano') {
      const rounds = Math.ceil((n - 1) / 2)
      const total = Math.floor(n / 4) * rounds
      const dur = Math.ceil(total / courts) * 20
      return {
        headline: `Américano · ${rounds} rondes`,
        detail: `→ ~${total} matchs`,
        duration: `${fmtDuration(dur)} sur ${courts} terrain${courts > 1 ? 's' : ''}`,
      }
    }

    if (data.format === 'swiss') {
      const roundsEstimate = Math.ceil(Math.log2(n)) + 1
      const matchesPerRound = Math.floor(n / 2)
      const total = matchesPerRound * roundsEstimate
      const dur = Math.ceil(matchesPerRound / courts) * 20 * roundsEstimate
      return {
        headline: `Système suisse · ~${roundsEstimate} rondes`,
        detail: `→ ~${matchesPerRound} matchs/ronde · ~${total} matchs total`,
        duration: `${fmtDuration(dur)} sur ${courts} terrain${courts > 1 ? 's' : ''}`,
      }
    }

    if (data.format === 'king-of-court') {
      const activeCourts = Math.min(courts, Math.floor(n / 2))
      return {
        headline: `Roi du court · ${activeCourts} terrain${activeCourts > 1 ? 's' : ''} actif${activeCourts > 1 ? 's' : ''}`,
        detail: `→ ${activeCourts} match${activeCourts > 1 ? 's' : ''} par ronde`,
        duration: `~20 min par ronde`,
      }
    }

    const total = Math.ceil(n / 2) * 3
    const dur = Math.ceil(total / courts) * 20
    return {
      headline: FORMAT_OPTIONS.find((f) => f.value === data.format)?.label ?? data.format,
      detail: `→ ~${total} matchs`,
      duration: `${fmtDuration(dur)} sur ${courts} terrain${courts > 1 ? 's' : ''}`,
    }
  }

  // ── Avertissements ───────────────────────────────────────────────────────
  const warnings: string[] = []

  if (n < 2) {
    warnings.push('Sélectionnez au moins 2 joueurs pour simuler le tournoi.')
  }

  if (data.format === 'knockout' && n < 3) {
    warnings.push('Élimination directe : recommandé avec au moins 4 joueurs.')
  }

  if (data.format === 'round-robin' && n < 3) {
    warnings.push(`Minimum 3 joueurs requis pour un tournoi toutes rondes (actuellement ${n}).`)
  }

  if (data.format === 'americano' && n < 4) {
    warnings.push(`Minimum 4 joueurs requis pour l'américano (actuellement ${n}).`)
  }

  if (data.format === 'swiss' && n < 4) {
    warnings.push(`Minimum 4 joueurs requis pour le système suisse (actuellement ${n}).`)
  }

  if (data.format === 'king-of-court' && n < 4) {
    warnings.push(`Minimum 4 joueurs requis pour le Roi du court (au moins 2 terrains × 2 joueurs, actuellement ${n}).`)
  }

  if (data.format === 'pool+knockout' && n < data.poolCount * 3) {
    warnings.push(
      `${data.poolCount} poules × 3 joueurs minimum = ${data.poolCount * 3} joueurs requis, mais seulement ${n} sélectionnés. Ajoutez des joueurs ou réduisez le nombre de poules.`
    )
  } else if (data.format === 'pool+knockout' && data.poolCount > Math.floor(n / 2)) {
    warnings.push(
      `${data.poolCount} groupes pour ${n} joueurs : certains groupes n'auront que 2 joueurs (recommandé : 3–6 par poule).`
    )
  }

  if (data.categories.includes('DX') && n >= 2) {
    const pairsPossible = Math.min(maleCount, femaleCount)
    const unpaired = Math.abs(maleCount - femaleCount)
    if (unpaired > 0) {
      warnings.push(
        `${n} joueurs en double mixte → ${pairsPossible} paire${pairsPossible !== 1 ? 's' : ''} H+F possible${pairsPossible !== 1 ? 's' : ''}. ` +
        `${unpaired} joueur${unpaired !== 1 ? 's' : ''} non appariable${unpaired !== 1 ? 's' : ''} — proposera ${unpaired} match${unpaired !== 1 ? 's' : ''} simple bonus.`
      )
    }
  }

  if ((data.categories.includes('DH') || data.categories.includes('DD')) && n >= 2) {
    if (n % 2 !== 0) {
      warnings.push(`${n} joueurs en double : 1 joueur sans partenaire — nécessite une composition manuelle.`)
    }
  }

  if (!data.scoringRuleId) {
    warnings.push('Aucune règle de scoring sélectionnée.')
  }

  const sim = simulate()

  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      {/* Nom */}
      <div>
        <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-1">Tournoi</p>
        <p className="font-sans font-black uppercase text-[28px] tracking-[-0.02em] text-ink leading-none">
          {data.name || '—'}
        </p>
        {data.date && (
          <p className="font-sans text-[13px] text-ink-3 mt-1">
            {new Date(data.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            {data.location ? ` · ${data.location}` : ''}
          </p>
        )}
      </div>

      {/* Stats clés */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3">Joueurs</p>
          <p className="font-sans font-black text-[28px] tracking-[-0.03em] text-ink leading-none mt-0.5">
            {n || '—'}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3">Terrains</p>
          <p className="font-sans font-black text-[28px] tracking-[-0.03em] text-ink leading-none mt-0.5">
            {courts}
          </p>
        </div>
        {data.categories.length > 0 && (
          <div className="col-span-2">
            <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-1.5">Catégories</p>
            <div className="flex gap-1 flex-wrap">
              {data.categories.map((c) => (
                <span key={c} className="text-[10px] font-mono font-bold px-2 py-1 bg-ink text-green-fluo">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
        {selectedRule && (
          <div className="col-span-2">
            <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-0.5">Règle de score</p>
            <p className="font-sans font-bold text-[13px] text-ink">{selectedRule.name}</p>
            <p className="font-sans text-[11px] text-ink-3 mt-0.5">
              {selectedRule.pointsPerSet} pts · {selectedRule.setsToWin * 2 - 1} sets max
              {selectedRule.hasDeuce ? ' · déuce' : ''}
              {selectedRule.maxScore > 0 ? ` · plafond ${selectedRule.maxScore}` : ''}
              {selectedRule.goldenPoint ? ' · golden point' : ''}
            </p>
          </div>
        )}
        {data.teamMode && (
          <div className="col-span-2">
            <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-1.5">Rencontre</p>
            <div className="flex flex-wrap items-center gap-2">
              {data.teamNames.map((name, idx) => {
                const letter = String.fromCharCode(65 + idx)
                const color = TEAM_COLORS[idx] ?? TEAM_COLORS[TEAM_COLORS.length - 1]
                const count = selectedPlayers.filter((p) => data.teamAssignments[p.id] === letter).length
                return (
                  <span key={idx}
                    className="px-2 py-1 font-mono font-bold text-[11px]"
                    style={{ backgroundColor: color.bg, color: color.text }}>
                    {name || `Équipe ${letter}`} · {count}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bloc simulation */}
      {sim && (
        <div className="border-2 border-line-soft p-4 flex flex-col gap-1">
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-2">Simulation</p>
          <p className="font-sans font-black text-[22px] tracking-[-0.02em] text-ink leading-tight">
            {sim.headline}
          </p>
          <p className="font-sans font-bold text-[13px] text-blue">{sim.detail}</p>
          <p className="font-sans text-[12px] text-ink-3 mt-1">Durée estimée : {sim.duration}</p>
        </div>
      )}

      {/* Avertissements */}
      {warnings.length > 0 && (
        <div className="border-2 border-warn p-4 flex flex-col gap-2">
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-warn mb-1">! Attention</p>
          {warnings.map((w, i) => (
            <p key={i} className="font-sans text-[12px] text-ink leading-snug">{w}</p>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Étapes ───────────────────────────────────────────────────────────────────

function Step1({
  data,
  onChange,
  onApplyModel,
  selectedModelId,
}: {
  data: WizardData
  onChange: (d: Partial<WizardData>) => void
  onApplyModel: (modelId: string) => void
  selectedModelId: string | null
}) {
  return (
    <div className="flex flex-col gap-5">
      <Input label="Nom du tournoi *" placeholder="Ex : Championnat interne printemps 2026"
        value={data.name} onChange={(e) => onChange({ name: e.target.value })} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Date" type="date" value={data.date}
          onChange={(e) => onChange({ date: e.target.value })} />
        <Input label="Lieu" placeholder="Ex : Gymnase Arago"
          value={data.location} onChange={(e) => onChange({ location: e.target.value })} />
      </div>
      <div>
        <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-2">
          Terrains disponibles
        </p>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }, (_, i) => i + 1).map((num) => {
            const active = num <= data.courtCount
            return (
              <button
                key={num}
                onClick={() => onChange({ courtCount: num === data.courtCount && num > 1 ? num - 1 : num })}
                className={`w-11 h-11 border-2 font-mono font-bold text-[12px] transition-colors
                  ${active ? 'bg-green-fluo text-ink border-green-fluo' : 'bg-bg text-ink-3 border-line hover:border-blue'}`}
              >
                T{num}
              </button>
            )
          })}
        </div>
        <p className="font-sans text-[12px] text-ink-3 mt-2">
          {data.courtCount} terrain{data.courtCount !== 1 ? 's' : ''} actif{data.courtCount !== 1 ? 's' : ''}
        </p>
      </div>

      <div>
        <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-2">
          Modèles de tournoi
          <span className="font-normal normal-case ml-2 text-ink-3">(optionnel)</span>
        </p>
        <div className="grid grid-cols-1 gap-2">
          {TOURNAMENT_MODELS.map((model) => {
            const selected = selectedModelId === model.id
            return (
              <button
                key={model.id}
                onClick={() => onApplyModel(model.id)}
                className={`text-left px-4 py-3 border-2 transition-colors
                  ${selected ? 'border-blue bg-blue/5' : 'border-line hover:border-blue/50 bg-bg'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-sans font-bold text-[13px] text-ink">{model.label}</span>
                  {selected && <Badge variant="active">Appliqué</Badge>}
                </div>
                <p className="font-sans text-[12px] text-ink-3 mt-0.5">{model.description}</p>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Step2({ data, players, onChange }: {
  data: WizardData
  players: ReturnType<typeof usePlayersStore.getState>['players']
  onChange: (d: Partial<WizardData>) => void
}) {
  type SortKey2 = 'playerNumber' | 'lastName' | 'firstName' | 'pseudo' | 'gender' | 'level' | 'club' | 'elo'
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey2>('lastName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const activePlayers = players.filter((p) => p.status === 'active')

  const handleSort = (key: SortKey2) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ k }: { k: SortKey2 }) =>
    sortKey === k
      ? sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
      : <ChevronsUpDown size={11} />

  const filtered = activePlayers.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      playerDisplayName(p).toLowerCase().includes(q) ||
      (p.firstName ?? '').toLowerCase().includes(q) ||
      (p.lastName ?? '').toLowerCase().includes(q) ||
      (p.pseudo ?? '').toLowerCase().includes(q) ||
      (p.club ?? '').toLowerCase().includes(q) ||
      (p.level ?? '').toLowerCase().includes(q) ||
      String(p.playerNumber ?? '').includes(q) ||
      String(p.elo ?? '').includes(q) ||
      (p.gender === 'M' ? 'h homme' : 'f femme').includes(q)
    )
  })

  const sorted = [...filtered].sort((a, b) => {
    let va: string | number = ''
    let vb: string | number = ''
    if (sortKey === 'playerNumber') { va = a.playerNumber ?? 9999; vb = b.playerNumber ?? 9999 }
    else if (sortKey === 'lastName')  { va = (a.lastName ?? '').toLowerCase(); vb = (b.lastName ?? '').toLowerCase() }
    else if (sortKey === 'firstName') { va = (a.firstName ?? '').toLowerCase(); vb = (b.firstName ?? '').toLowerCase() }
    else if (sortKey === 'pseudo')    { va = (a.pseudo ?? '').toLowerCase(); vb = (b.pseudo ?? '').toLowerCase() }
    else if (sortKey === 'gender')    { va = a.gender ?? ''; vb = b.gender ?? '' }
    else if (sortKey === 'level')     { va = (a.level ?? '').toLowerCase(); vb = (b.level ?? '').toLowerCase() }
    else if (sortKey === 'club')      { va = (a.club ?? '').toLowerCase(); vb = (b.club ?? '').toLowerCase() }
    else if (sortKey === 'elo')       { va = a.elo ?? 0; vb = b.elo ?? 0 }
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const toggle = (id: number) => {
    const ids = data.selectedPlayerIds
    onChange({ selectedPlayerIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] })
  }

  const toggleAll = () => {
    if (data.selectedPlayerIds.length === activePlayers.length) {
      onChange({ selectedPlayerIds: [] })
    } else {
      onChange({ selectedPlayerIds: activePlayers.map((p) => p.id) })
    }
  }

  // colonnes : [label, sortKey | null, alignRight?]
  const COLS: [string, SortKey2 | null, boolean?][] = [
    ['#',       'playerNumber', false],
    ['Nom',     'lastName',     false],
    ['Prénom',  'firstName',    false],
    ['Pseudo',  'pseudo',       false],
    ['G.',      'gender',       false],
    ['Niveau',  'level',        false],
    ['Club',    'club',         false],
    ['ELO',     'elo',          true],
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="font-sans text-[14px] text-ink-3">
          {data.selectedPlayerIds.length} / {activePlayers.length} joueurs sélectionnés
        </p>
        <button onClick={toggleAll}
          className="text-[12px] font-sans font-bold text-blue hover:underline">
          {data.selectedPlayerIds.length === activePlayers.length ? 'Désélectionner tout' : 'Sélectionner tout'}
        </button>
      </div>

      <input type="text" placeholder="Rechercher (nom, club, niveau, ELO…)" value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="bg-bg border border-line hover:border-blue focus:border-blue px-3 py-2
          w-full min-h-[44px] font-sans text-[14px] outline-none placeholder:text-ink-3" />

      <div className="border-2 border-line overflow-hidden">
        {/* En-têtes */}
        <div className="grid bg-ink"
          style={{ gridTemplateColumns: '32px 40px 1fr 1fr 1fr 40px 90px 1fr 64px' }}>
          {/* Case à cocher globale */}
          <div className="flex items-center justify-center px-2 py-2">
            <div
              onClick={toggleAll}
              className={`w-4 h-4 border-2 flex items-center justify-center cursor-pointer shrink-0
                ${data.selectedPlayerIds.length === activePlayers.length && activePlayers.length > 0
                  ? 'bg-green-fluo border-green-fluo'
                  : 'border-green-fluo/40'}`}
            >
              {data.selectedPlayerIds.length === activePlayers.length && activePlayers.length > 0 && (
                <span className="text-ink text-[9px] font-bold leading-none">✓</span>
              )}
            </div>
          </div>
          {COLS.map(([label, key, right]) => (
            key ? (
              <button key={label} onClick={() => handleSort(key)}
                className={`flex items-center gap-1 px-2 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.08em]
                  text-green-fluo hover:text-white transition-colors group ${right ? 'justify-end' : ''}`}
              >
                {label}
                <span className="text-green-fluo/60 group-hover:text-white/60"><SortIcon k={key} /></span>
              </button>
            ) : (
              <span key={label} className="px-2 py-2" />
            )
          ))}
        </div>

        {/* Lignes */}
        <div className="max-h-[360px] overflow-y-auto scrollbar-light">
          {sorted.map((p, i) => {
            const selected = data.selectedPlayerIds.includes(p.id)
            return (
              <div key={p.id} onClick={() => toggle(p.id)}
                className={`grid items-center cursor-pointer border-b border-line-soft transition-colors
                  hover:bg-bg-strong ${selected ? 'bg-blue/10' : i % 2 === 0 ? 'bg-bg' : 'bg-bg-alt'}`}
                style={{ gridTemplateColumns: '32px 40px 1fr 1fr 1fr 40px 90px 1fr 64px' }}
              >
                {/* Checkbox */}
                <div className="flex items-center justify-center px-2 py-2">
                  <div className={`w-4 h-4 border-2 flex items-center justify-center shrink-0
                    ${selected ? 'bg-blue border-blue' : 'border-line'}`}>
                    {selected && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
                  </div>
                </div>
                {/* # */}
                <span className="font-mono font-bold text-[12px] text-ink-3 px-2 py-2">
                  {p.playerNumber != null ? String(p.playerNumber).padStart(2, '0') : '—'}
                </span>
                {/* Nom */}
                <span className="font-sans font-black text-[13px] text-ink uppercase tracking-[-0.01em] px-2 py-2 truncate">
                  {p.lastName.toUpperCase()}
                </span>
                {/* Prénom */}
                <span className="font-sans text-[13px] text-ink-2 px-2 py-2 truncate">{p.firstName}</span>
                {/* Pseudo */}
                <span className="font-mono text-[11px] text-ink-3 px-2 py-2 truncate">
                  {p.pseudo ? `"${p.pseudo}"` : <span className="opacity-30">—</span>}
                </span>
                {/* Genre */}
                <div className="flex items-center justify-center px-1 py-2">
                  <Tag label={p.gender === 'M' ? 'H' : 'F'} color={p.gender === 'M' ? 'H' : 'F'} className="w-6 h-6 justify-center px-0 py-0 text-[9px]" />
                </div>
                {/* Niveau */}
                <span className="text-[11px] font-mono font-bold text-ink-2 uppercase px-2 py-2">{p.level ?? '—'}</span>
                {/* Club */}
                <span className="font-sans text-[12px] text-ink-2 px-2 py-2 truncate">
                  {p.club || <span className="text-ink-3">—</span>}
                </span>
                {/* ELO */}
                <span className={`font-mono font-bold text-[14px] text-right px-3 py-2
                  ${(p.elo ?? 0) >= 1200 ? 'text-blue' : (p.elo ?? 0) >= 1000 ? 'text-ink' : 'text-ink-3'}`}>
                  {p.elo ?? '—'}
                </span>
              </div>
            )
          })}
          {sorted.length === 0 && (
            <p className="px-4 py-6 text-center font-sans text-[14px] text-ink-3">
              Aucun joueur actif trouvé
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/** Étape 3 : Mode équipes — activation, noms, et assignation des joueurs */
function Step3Teams({ data, players, onChange }: {
  data: WizardData
  players: ReturnType<typeof usePlayersStore.getState>['players']
  onChange: (d: Partial<WizardData>) => void
}) {
  const selected = players.filter((p) => data.selectedPlayerIds.includes(p.id))
  const teamLetters = data.teamNames.map((_, idx) => String.fromCharCode(65 + idx))

  const assign = (playerId: number, letter: string | null) => {
    const updated = { ...data.teamAssignments }
    if (letter === null) delete updated[playerId]
    else updated[playerId] = letter
    onChange({ teamAssignments: updated })
  }

  const autoAssignByClub = () => {
    const clubs = Array.from(new Set(selected.map((p) => p.club).filter(Boolean))) as string[]
    if (clubs.length < 2) return
    const updated: Record<number, string> = {}
    for (const p of selected) {
      const clubIdx = clubs.indexOf(p.club ?? '')
      // Utilise clubs.length (pas teamLetters.length) car les équipes sont créées dans le même appel
      if (clubIdx >= 0 && clubIdx < 8) updated[p.id] = String.fromCharCode(65 + clubIdx)
    }
    // Met à jour les noms d'équipes avec les noms de clubs
    const updatedNames = clubs.slice(0, 8).map((club, i) => club || data.teamNames[i] || `Équipe ${String.fromCharCode(65 + i)}`)
    // S'assure d'avoir autant d'entrées que teamNames actuel (au minimum 2)
    while (updatedNames.length < Math.max(2, data.teamNames.length)) {
      updatedNames.push(`Équipe ${String.fromCharCode(65 + updatedNames.length)}`)
    }
    onChange({ teamAssignments: updated, teamNames: updatedNames })
  }

  const clubs = Array.from(new Set(selected.map((p) => p.club).filter(Boolean)))
  const counts = teamLetters.map((l) => selected.filter((p) => data.teamAssignments[p.id] === l).length)

  const removeTeam = (idx: number) => {
    const next = data.teamNames.filter((_, i) => i !== idx)
    const cutLetter = String.fromCharCode(65 + idx)
    const newAssign: Record<number, string> = {}
    for (const [pid, side] of Object.entries(data.teamAssignments)) {
      if (side < cutLetter) newAssign[Number(pid)] = side
      else if (side > cutLetter) newAssign[Number(pid)] = String.fromCharCode(side.charCodeAt(0) - 1)
    }
    onChange({ teamNames: next, teamAssignments: newAssign })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Toggle mode équipes */}
      <div className="border-2 border-line p-4 flex items-center justify-between">
        <div>
          <p className="font-sans font-bold text-[14px] text-ink">Mode rencontre par équipes</p>
          <p className="font-sans text-[12px] text-ink-3 mt-0.5">
            Activez pour opposer des clubs / équipes. Laissez désactivé pour un tournoi individuel.
          </p>
        </div>
        <button
          onClick={() => onChange({ teamMode: !data.teamMode })}
          className={`shrink-0 w-12 h-6 border-2 transition-colors relative ${data.teamMode ? 'bg-ink border-ink' : 'bg-bg border-line'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 transition-all ${data.teamMode ? 'left-6 bg-green-fluo' : 'left-0.5 bg-ink-3'}`} />
        </button>
      </div>

      {!data.teamMode && (
        <p className="font-sans text-[13px] text-ink-3">
          Tournoi individuel — pas d'équipes. Cliquez sur Suivant pour continuer.
        </p>
      )}

      {data.teamMode && (
        <>
          {/* Noms des équipes */}
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3">Noms des équipes</p>
            {data.teamNames.map((name, idx) => {
              const letter = String.fromCharCode(65 + idx)
              const color = TEAM_COLORS[idx] ?? TEAM_COLORS[TEAM_COLORS.length - 1]
              return (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-7 h-7 flex items-center justify-center font-mono font-bold text-[11px] shrink-0"
                    style={{ backgroundColor: color.bg, color: color.text }}>
                    {letter}
                  </span>
                  <input type="text" placeholder={`Équipe ${letter}`} value={name}
                    onChange={(e) => {
                      const next = [...data.teamNames]
                      next[idx] = e.target.value
                      onChange({ teamNames: next })
                    }}
                    className="flex-1 bg-bg border border-line hover:border-blue focus:border-blue px-3 py-2
                      min-h-[36px] font-sans text-[13px] outline-none placeholder:text-ink-3"
                  />
                  {data.teamNames.length > 2 && (
                    <button onClick={() => removeTeam(idx)}
                      className="w-7 h-7 flex items-center justify-center text-ink-3 hover:text-red border border-line hover:border-red transition-colors shrink-0 text-[14px] font-bold"
                      title="Supprimer cette équipe">×</button>
                  )}
                </div>
              )
            })}
            {data.teamNames.length < 8 && (
              <button
                onClick={() => onChange({ teamNames: [...data.teamNames, `Équipe ${String.fromCharCode(65 + data.teamNames.length)}`] })}
                className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-line-soft hover:border-blue
                  text-[12px] font-sans font-bold text-ink-3 hover:text-blue transition-colors self-start"
              >+ Ajouter une équipe</button>
            )}
          </div>

          {/* Assignation des joueurs */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3">Assignation des joueurs</p>
              {clubs.length >= 2 && (
                <button onClick={autoAssignByClub}
                  className="text-[12px] font-sans font-bold text-blue hover:underline shrink-0">
                  Assigner par club
                </button>
              )}
            </div>

            {/* Compteurs */}
            <div className="flex flex-wrap gap-2">
              {data.teamNames.map((name, idx) => {
                const letter = teamLetters[idx]
                const color = TEAM_COLORS[idx] ?? TEAM_COLORS[TEAM_COLORS.length - 1]
                return (
                  <span key={idx} className="px-3 py-1 font-mono font-bold text-[11px] uppercase tracking-[0.08em]"
                    style={{ backgroundColor: color.bg, color: color.text }}>
                    {name || `Équipe ${letter}`} — {counts[idx]}
                  </span>
                )
              })}
              <span className="px-3 py-1 border-2 border-line-soft font-mono font-bold text-[11px] uppercase tracking-[0.08em] text-ink-3">
                Non assigné — {selected.filter((p) => !data.teamAssignments[p.id]).length}
              </span>
            </div>

            <div className="border-2 border-line flex flex-col max-h-[340px] overflow-y-auto scrollbar-light">
              {selected.map((p, i) => {
                const currentLetter = data.teamAssignments[p.id] ?? null
                return (
                  <div key={p.id}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-line-soft
                      ${i % 2 === 0 ? 'bg-bg' : 'bg-bg-alt'}`}>
                    <Tag label={p.gender === 'M' ? 'H' : 'F'} color={p.gender === 'M' ? 'H' : 'F'} />
                    <div className="flex-1 min-w-0">
                      <span className="font-sans font-bold text-[14px] text-ink">{playerDisplayName(p)}</span>
                      {p.club && <span className="font-mono text-[11px] text-ink-3 ml-2">{p.club}</span>}
                    </div>
                    {currentLetter !== null && (
                      <button onClick={() => assign(p.id, null)}
                        className="w-7 h-7 flex items-center justify-center text-ink-3 hover:text-red border border-line hover:border-red transition-colors text-[14px] font-bold shrink-0"
                        title="Retirer de l'équipe">×</button>
                    )}
                    <div className="flex gap-1 flex-wrap">
                      {teamLetters.map((letter, idx) => {
                        const color = TEAM_COLORS[idx] ?? TEAM_COLORS[TEAM_COLORS.length - 1]
                        const active = currentLetter === letter
                        const name = data.teamNames[idx] || `Équipe ${letter}`
                        return (
                          <button key={letter} onClick={() => assign(p.id, active ? null : letter)}
                            title={name}
                            className="min-w-[36px] h-9 px-2 font-mono font-bold text-[11px] border-2 transition-all"
                            style={active
                              ? { backgroundColor: color.bg, color: color.text, borderColor: color.bg }
                              : { backgroundColor: 'transparent', color: '#8a8a82', borderColor: '#cfcdc4' }
                            }>{letter}</button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {selected.length === 0 && (
                <p className="px-4 py-6 text-center font-sans text-[14px] text-ink-3">
                  Aucun joueur sélectionné — retournez à l'étape Joueurs.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Step3({ data, onChange }: { data: WizardData; onChange: (d: Partial<WizardData>) => void }) {  const toggleCategory = (cat: MatchCategory) => {
    const cats = data.categories
    onChange({
      categories: cats.includes(cat) ? cats.filter((c) => c !== cat) : [...cats, cat],
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Choix du format */}
      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3">Format de compétition</p>
        {FORMAT_OPTIONS.map((opt) => (
          <div key={opt.value}
            onClick={() => !opt.disabled && onChange({ format: opt.value })}
            className={`px-4 py-3 border-2 transition-colors
              ${opt.disabled
                ? 'border-line-soft bg-bg-alt opacity-50 cursor-not-allowed'
                : data.format === opt.value
                  ? 'border-blue bg-blue/5 cursor-pointer'
                  : 'border-line hover:border-blue/50 bg-bg cursor-pointer'}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-sans font-bold text-[14px] text-ink">{opt.label}</span>
              {opt.disabled && <Badge variant="default">Bientôt</Badge>}
              {!opt.disabled && data.format === opt.value && <Badge variant="active">Sélectionné</Badge>}
            </div>
            <p className="font-sans text-[12px] text-ink-3 mt-0.5">
              {opt.disabled ? 'Non disponible dans cette version' : FORMAT_LABELS[opt.value]}
            </p>
            {!opt.disabled && data.format === opt.value && FORMAT_STEPS[opt.value] && (
              <ol className="mt-2 flex flex-col gap-1">
                {FORMAT_STEPS[opt.value]!.map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="shrink-0 w-4 h-4 mt-0.5 bg-blue text-white font-mono font-bold text-[9px] flex items-center justify-center">{i + 1}</span>
                    <span className="font-sans text-[11px] text-ink-2">{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>

      {/* Disciplines */}
      <div>
        <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-2">
          Disciplines jouées
          <span className="font-normal normal-case ml-2 text-ink-3">(optionnel)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CATEGORY_LABELS) as MatchCategory[]).map((cat) => {
            const selected = data.categories.includes(cat)
            return (
              <button key={cat} onClick={() => toggleCategory(cat)}
                className={`flex items-center gap-2 px-4 py-2 min-h-[44px] border-2 transition-colors
                  font-mono font-bold text-[12px] uppercase
                  ${selected ? 'bg-ink text-green-fluo border-ink' : 'bg-bg text-ink border-line hover:bg-bg-strong'}`}
              >
                {cat} <span className="font-sans font-normal text-[11px]">{CATEGORY_LABELS[cat]}</span>
              </button>
            )
          })}
        </div>
        {data.categories.length === 0 && (
          <p className="font-sans text-[12px] text-ink-3 mt-2">Tournoi open (toutes disciplines)</p>
        )}
      </div>
    </div>
  )
}

function Step4({ data, rules, onChange }: {
  data: WizardData
  rules: ReturnType<typeof useRulesStore.getState>['rules']
  onChange: (d: Partial<WizardData>) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-sans text-[14px] text-ink-3">
        Choisissez la règle de scoring qui s'appliquera à tous les matchs du tournoi.
      </p>
      {rules.map((rule) => (
        <div key={rule.id}
          onClick={() => onChange({ scoringRuleId: rule.id })}
          className={`px-4 py-4 border-2 cursor-pointer transition-colors
            ${data.scoringRuleId === rule.id ? 'border-blue bg-blue/5' : 'border-line hover:border-blue/50 bg-bg'}`}
        >
          <div className="flex items-center justify-between">
            <span className="font-sans font-bold text-[14px] text-ink">{rule.name}</span>
            <div className="flex gap-2">
              {!rule.isCustom && <Badge variant="info">Préset</Badge>}
              {data.scoringRuleId === rule.id && <Badge variant="active">Sélectionné</Badge>}
            </div>
          </div>
          <p className="font-sans text-[12px] text-ink-3 mt-1">
            {rule.setsToWin} sets · {rule.pointsPerSet} pts
            {rule.hasDeuce ? ' · déuce' : ''}
            {rule.maxScore > 0 ? ` · golden point ${rule.maxScore}` : ''}
          </p>
        </div>
      ))}
      {rules.length === 0 && (
        <p className="font-sans text-[14px] text-ink-3 py-4">
          Aucune règle disponible — créez-en une dans Configuration.
        </p>
      )}
    </div>
  )
}

// ─── Helpers paires doubles ──────────────────────────────────────────────────

function eligibleForSlotW(cat: MatchCategory, slot: 0 | 1, players: Player[]): Player[] {
  if (cat === 'DX') return slot === 0 ? players.filter((p) => p.gender === 'M') : players.filter((p) => p.gender === 'F')
  if (cat === 'DH') return players.filter((p) => p.gender === 'M')
  if (cat === 'DD') return players.filter((p) => p.gender === 'F')
  return players
}

function buildRandomPairsW(players: Player[], cat: MatchCategory): [number, number][] {
  if (cat === 'DX') {
    const males = [...players.filter((p) => p.gender === 'M')].sort(() => Math.random() - 0.5)
    const females = [...players.filter((p) => p.gender === 'F')].sort(() => Math.random() - 0.5)
    const count = Math.min(males.length, females.length)
    return Array.from({ length: count }, (_, i) => [males[i].id, females[i].id])
  }
  const eligible = cat === 'DH'
    ? players.filter((p) => p.gender === 'M')
    : cat === 'DD' ? players.filter((p) => p.gender === 'F') : players
  const shuffled = [...eligible].sort(() => Math.random() - 0.5)
  const pairs: [number, number][] = []
  for (let i = 0; i + 1 < shuffled.length; i += 2) pairs.push([shuffled[i].id, shuffled[i + 1].id])
  return pairs
}

/** Génère des paires en respectant les équipes (interclub) : chaque paire = 2 joueurs de la même équipe. */
function buildTeamPairsW(
  players: Player[],
  cat: MatchCategory,
  teamAssignments: Record<number, string>,
  teamNames: string[],
): [number, number][] {
  const teamLetters = teamNames.map((_, idx) => String.fromCharCode(65 + idx))
  const pairs: [number, number][] = []
  for (const letter of teamLetters) {
    const teamPlayers = players.filter((p) => teamAssignments[p.id] === letter)
    if (cat === 'DX') {
      const men = [...teamPlayers.filter((p) => p.gender === 'M')].sort(() => Math.random() - 0.5)
      const women = [...teamPlayers.filter((p) => p.gender === 'F')].sort(() => Math.random() - 0.5)
      const count = Math.min(men.length, women.length)
      for (let i = 0; i < count; i++) pairs.push([men[i].id, women[i].id])
    } else {
      const eligible = eligibleForSlotW(cat, 0, teamPlayers)
      const shuffled = [...eligible].sort(() => Math.random() - 0.5)
      for (let i = 0; i + 1 < shuffled.length; i += 2) pairs.push([shuffled[i].id, shuffled[i + 1].id])
    }
  }
  return pairs
}

// ─── Carte joueur mini (utilisée dans Composition + Bracket) ─────────────────

function PlayerMiniCard({
  player,
  selected,
  dimmed,
  onSelect,
  onRemove,
  placeholder,
  onClick,
  teamColor,
}: {
  player?: Player
  selected?: boolean
  dimmed?: boolean
  onSelect?: () => void
  onRemove?: () => void
  placeholder?: string
  onClick?: () => void
  /** Couleur d'équipe — remplace la barre genre si définie (mode interclub) */
  teamColor?: { bg: string; text: string }
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
          min-h-[56px] w-full transition-colors text-left"
      >
        <div className="w-8 h-8 flex items-center justify-center bg-bg-strong text-ink-3 font-mono font-bold text-[11px] shrink-0">
          ?
        </div>
        <span className="font-sans text-[12px] text-ink-3 italic">
          {placeholder ?? 'Sélectionner…'}
        </span>
      </button>
    )
  }

  return (
    <div
      onClick={onSelect ?? onClick}
      className={`relative flex items-center gap-2 px-3 py-2 border-2 min-h-[56px] w-full transition-all
        ${onSelect || onClick ? 'cursor-pointer' : 'cursor-default'}
        ${selected ? 'border-blue' : dimmed ? 'border-line-soft opacity-40' : 'border-line hover:border-ink'}`}
      style={teamColor
        ? { backgroundColor: teamColor.bg + '33' }
        : selected ? { backgroundColor: 'rgba(0,71,255,0.06)' } : {}}
    >
      {/* Barre couleur côté gauche : équipe si teamColor, sinon genre */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] shrink-0"
        style={{ backgroundColor: teamColor ? teamColor.bg : (isH ? '#0047FF' : '#00C24A') }} />
      {/* Initiales */}
      <div className="w-8 h-8 flex items-center justify-center font-mono font-black text-[11px] shrink-0 ml-2"
        style={teamColor
          ? { backgroundColor: teamColor.bg, color: teamColor.text }
          : { backgroundColor: isH ? '#0047FF' : '#0a0a0a', color: isH ? '#fff' : '#00FF66' }}>
        {initials}
      </div>
      {/* Infos */}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="font-sans font-bold text-[13px] text-ink truncate leading-tight">
          {playerDisplayName(player)}
        </span>
        {player.club && (
          <span className="font-mono text-[10px] text-ink-3 truncate">{player.club}</span>
        )}
      </div>
      {/* Tag genre */}
      <Tag label={isH ? 'H' : 'F'} color={isH ? 'H' : 'F'} />
      {/* Bouton retirer */}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="shrink-0 w-7 h-7 flex items-center justify-center text-ink-3 hover:text-red transition-colors ml-1"
          title="Retirer"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}

// ─── Step 6 — Composition des poules ─────────────────────────────────────────

/** Dispatch vers le mode doubles ou singles selon les catégories sélectionnées */
function StepPools({ data, players, onChange }: {
  data: WizardData
  players: Player[]
  onChange: (d: Partial<WizardData>) => void
}) {
  const doublesCats = data.categories.filter((c) => DOUBLES_CATS.includes(c))
  return (
    <div className="flex flex-col gap-8">
      {/* Nombre de groupes */}
      <div>
        <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-2">
          Nombre de poules
        </p>
        <div className="flex gap-2">
          {[2, 3, 4, 6, 8].map((n) => (
            <button key={n} onClick={() => onChange({ poolCount: n })}
              className={`px-4 py-2 min-h-[44px] font-mono font-bold text-[14px] border-2 transition-colors
                ${data.poolCount === n ? 'bg-ink text-green-fluo border-ink' : 'bg-bg text-ink border-line hover:bg-bg-strong'}`}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Composition des poules */}
      {doublesCats.length > 0
        ? <StepPoolsDoubles data={data} players={players} onChange={onChange} doublesCats={doublesCats} />
        : <StepPoolsSingles data={data} players={players} onChange={onChange} />
      }
    </div>
  )
}

// ─── Mode singles — joueurs individuels ──────────────────────────────────────

function StepPoolsSingles({ data, players, onChange }: {
  data: WizardData
  players: Player[]
  onChange: (d: Partial<WizardData>) => void
}) {
  const selectedPlayers = players.filter((p) => data.selectedPlayerIds.includes(p.id))
  const poolCount = data.poolCount

  // Drag state local (pas besoin de persister)
  const [dragPlayerId, setDragPlayerId] = useState<number | null>(null)
  const [dragOverPool, setDragOverPool] = useState<number | null>(null)

  // Initialise (ou réinitialise) aléatoirement si la composition ne correspond plus
  useEffect(() => {
    const assigned = data.poolAssignments.flat()
    const isValid =
      data.poolAssignments.length === poolCount &&
      assigned.length === data.selectedPlayerIds.length &&
      data.selectedPlayerIds.every((id) => assigned.includes(id))
    if (!isValid) {
      // Tirage aléatoire par défaut — fonctionne même sans niveau renseigné
      const shuffled = [...selectedPlayers].sort(() => Math.random() - 0.5)
      onChange({ poolAssignments: splitIntoPools(shuffled.map((p) => p.id), poolCount) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolCount, data.selectedPlayerIds.length])

  const handleShuffle = () => {
    const shuffled = [...selectedPlayers].sort(() => Math.random() - 0.5)
    onChange({ poolAssignments: splitIntoPools(shuffled.map((p) => p.id), poolCount) })
  }

  const movePlayer = (playerId: number, toPool: number) => {
    if (toPool < 0 || toPool >= poolCount) return
    const next = data.poolAssignments.map((pool) => pool.filter((id) => id !== playerId))
    next[toPool] = [...(next[toPool] ?? []), playerId]
    onChange({ poolAssignments: next })
  }

  const handleDrop = (toPool: number) => {
    if (dragPlayerId !== null) movePlayer(dragPlayerId, toPool)
    setDragPlayerId(null)
    setDragOverPool(null)
  }

  // Protège contre un état transitoire avant l'effet d'initialisation
  const assignments: number[][] =
    data.poolAssignments.length === poolCount
      ? data.poolAssignments
      : Array.from({ length: poolCount }, () => [])

  const anyTooSmall = assignments.some((p) => p.length < 3)

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-black uppercase text-[14px] tracking-[-0.01em] text-ink">Composition des poules</p>
          <p className="font-sans text-[12px] text-ink-3 mt-0.5">
            Glissez-déposez les joueurs pour les déplacer entre les groupes.
            Recommandé : 3–6 joueurs par poule.
          </p>
        </div>
        <button
          onClick={handleShuffle}
          className="shrink-0 flex items-center gap-2 px-4 py-2 bg-ink text-green-fluo font-black uppercase text-[11px] tracking-[0.05em] border-2 border-ink hover:opacity-80"
        >
          <Shuffle size={12} />
          Aléatoire
        </button>
      </div>

      {anyTooSmall && (
        <div className="px-4 py-3 border-2 border-warn bg-warn/10 font-mono text-[11px] font-bold uppercase text-warn tracking-[0.05em]">
          ⚠ Certains groupes ont moins de 3 joueurs — le minimum recommandé est 3 joueurs par poule.
        </div>
      )}

      {/* Colonnes des groupes */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.min(poolCount, 4)}, 1fr)` }}
      >
        {assignments.map((poolIds, poolIdx) => {
          const groupLetter = String.fromCharCode(65 + poolIdx)
          const tooSmall = poolIds.length < 2
          const isDragTarget = dragOverPool === poolIdx
          const poolPlayers = poolIds
            .map((id) => players.find((p) => p.id === id))
            .filter((p): p is Player => p !== undefined)

          return (
            <div
              key={poolIdx}
              className={`border-2 transition-colors ${
                isDragTarget
                  ? 'border-green-fluo bg-green-fluo/5'
                  : tooSmall && poolIds.length > 0
                    ? 'border-warn'
                    : 'border-line'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOverPool(poolIdx) }}
              onDragLeave={(e) => {
                // Ne pas réinitialiser si on survole un enfant
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverPool(null)
              }}
              onDrop={() => handleDrop(poolIdx)}
            >
              {/* En-tête neutre */}
              <div className="px-3 py-2 flex items-center justify-between bg-bg-strong border-b-2 border-line">
                <span className="font-mono font-bold text-[11px] uppercase tracking-[0.08em] text-ink">
                  Groupe {groupLetter}
                </span>
                <span className="font-mono text-[11px] text-ink-3">
                  {poolIds.length} joueur{poolIds.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Zone de dépôt vide */}
              <div
                className={`divide-y divide-line-soft min-h-[48px] ${isDragTarget && poolPlayers.length === 0 ? 'bg-green-fluo/10' : ''}`}
              >
                {poolPlayers.map((player) => {
                  const isDragging = dragPlayerId === player.id
                  return (
                    <div
                      key={player.id}
                      draggable
                      onDragStart={() => { setDragPlayerId(player.id); setDragOverPool(null) }}
                      onDragEnd={() => { setDragPlayerId(null); setDragOverPool(null) }}
                      className={`flex items-center gap-2 px-2 py-2.5 cursor-grab active:cursor-grabbing select-none transition-opacity
                        ${isDragging ? 'opacity-30' : 'bg-bg hover:bg-bg-alt'}`}
                    >
                      {/* Poignée de drag */}
                      <span className="text-ink-3 flex-shrink-0" style={{ fontSize: 10, lineHeight: 1 }}>⠿</span>
                      {/* Carré couleur équipe */}
                      {(() => {
                        const letter = data.teamAssignments[player.id]
                        if (!letter) return null
                        const idx = letter.charCodeAt(0) - 65
                        const color = TEAM_COLORS[idx] ?? TEAM_COLORS[TEAM_COLORS.length - 1]
                        return <span className="w-3 h-3 shrink-0" style={{ backgroundColor: color.bg }} />
                      })()}
                      <span className="flex-1 font-sans text-[13px] text-ink truncate min-w-0">
                        {playerDisplayName(player)}
                      </span>
                    </div>
                  )
                })}
                {poolPlayers.length === 0 && (
                  <div className={`px-3 py-4 text-center font-sans text-[12px] text-ink-3 italic ${isDragTarget ? 'text-green' : ''}`}>
                    {isDragTarget ? 'Déposer ici' : 'Aucun joueur'}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="font-sans text-[11px] text-ink-3">
        Faites glisser un joueur vers un autre groupe pour le déplacer. Le bouton "Aléatoire" redistribue tous les joueurs de façon aléatoire.
      </p>
    </div>
  )
}

// ─── Mode doubles — paires ────────────────────────────────────────────────────

function StepPoolsDoubles({ data, players, onChange, doublesCats }: {
  data: WizardData
  players: Player[]
  onChange: (d: Partial<WizardData>) => void
  doublesCats: MatchCategory[]
}) {
  const poolCount = data.poolCount
  const [activeTab, setActiveTab] = useState<MatchCategory>(doublesCats[0]!)
  const [dragPairIdx, setDragPairIdx] = useState<number | null>(null)
  const [dragOverPool, setDragOverPool] = useState<number | null>(null)

  const getPairs = (cat: MatchCategory): [number, number][] =>
    ((data.doublesTeams[cat] ?? []) as [number, number][]).filter(([a, b]) => a > 0 && b > 0 && a !== b)

  const getAssignments = (cat: MatchCategory): number[][] => {
    const pairs = getPairs(cat)
    const existing = data.doublesPoolAssignments?.[cat]
    if (!existing || existing.flat().length !== pairs.length || existing.length !== poolCount) {
      return splitIntoPools(pairs.map((_, i) => i), poolCount)
    }
    return existing
  }

  const setAssignments = (cat: MatchCategory, assignments: number[][]) => {
    onChange({ doublesPoolAssignments: { ...data.doublesPoolAssignments, [cat]: assignments } })
  }

  // Auto-initialise les assignments quand les paires ou le nombre de poules changent
  const pairCountsKey = doublesCats.map((cat) => getPairs(cat).length).join(',')
  useEffect(() => {
    const updates: Partial<Record<MatchCategory, number[][]>> = {}
    let needsUpdate = false
    for (const cat of doublesCats) {
      const pairs = getPairs(cat)
      const existing = data.doublesPoolAssignments?.[cat]
      if (!existing || existing.flat().length !== pairs.length || existing.length !== poolCount) {
        const indices = pairs.map((_, i) => i).sort(() => Math.random() - 0.5)
        updates[cat] = splitIntoPools(indices, poolCount)
        needsUpdate = true
      }
    }
    if (needsUpdate) {
      onChange({ doublesPoolAssignments: { ...data.doublesPoolAssignments, ...updates } })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolCount, pairCountsKey, doublesCats.join(',')])

  const handleShuffle = () => {
    const pairs = getPairs(activeTab)
    const indices = pairs.map((_, i) => i).sort(() => Math.random() - 0.5)
    setAssignments(activeTab, splitIntoPools(indices, poolCount))
  }

  const movePair = (pairIdx: number, toPool: number) => {
    if (toPool < 0 || toPool >= poolCount) return
    const current = getAssignments(activeTab)
    const next = current.map((pool) => pool.filter((i) => i !== pairIdx))
    next[toPool] = [...(next[toPool] ?? []), pairIdx]
    setAssignments(activeTab, next)
  }

  const handleDrop = (toPool: number) => {
    if (dragPairIdx !== null) movePair(dragPairIdx, toPool)
    setDragPairIdx(null)
    setDragOverPool(null)
  }

  const activePairs = getPairs(activeTab)
  const assignments: number[][] =
    getAssignments(activeTab).length === poolCount
      ? getAssignments(activeTab)
      : Array.from({ length: poolCount }, () => [])

  const anyTooSmall = assignments.some((p) => p.length < 2)

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-black uppercase text-[14px] tracking-[-0.01em] text-ink">Composition des poules</p>
          <p className="font-sans text-[12px] text-ink-3 mt-0.5">
            Glissez-déposez les paires entre les groupes. Recommandé : 3–4 paires par poule.
          </p>
        </div>
        <button
          onClick={handleShuffle}
          className="shrink-0 flex items-center gap-2 px-4 py-2 bg-ink text-green-fluo font-black uppercase text-[11px] tracking-[0.05em] border-2 border-ink hover:opacity-80"
        >
          <Shuffle size={12} />
          Aléatoire
        </button>
      </div>

      {/* Onglets catégories doubles (si plusieurs) */}
      {doublesCats.length > 1 && (
        <div className="flex gap-0 border-2 border-line self-start">
          {doublesCats.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`px-4 py-2 font-mono font-bold text-[11px] uppercase tracking-[0.08em] transition-colors
                ${activeTab === cat ? 'bg-ink text-green-fluo' : 'bg-bg text-ink-3 hover:text-ink'}`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      )}

      {activePairs.length === 0 && (
        <div className="px-4 py-3 border-2 border-warn bg-warn/10 font-mono text-[11px] font-bold uppercase text-warn tracking-[0.05em]">
          ⚠ Aucune paire configurée pour {CATEGORY_LABELS[activeTab]}. Retournez à l'étape Composition.
        </div>
      )}

      {anyTooSmall && activePairs.length > 0 && (
        <div className="px-4 py-3 border-2 border-warn bg-warn/10 font-mono text-[11px] font-bold uppercase text-warn tracking-[0.05em]">
          ⚠ Certains groupes ont moins de 2 paires — recommandé : 3 paires minimum par poule.
        </div>
      )}

      {/* Colonnes des groupes */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.min(poolCount, 4)}, 1fr)` }}
      >
        {assignments.map((poolPairIndices, poolIdx) => {
          const groupLetter = String.fromCharCode(65 + poolIdx)
          const tooSmall = poolPairIndices.length < 2
          const isDragTarget = dragOverPool === poolIdx

          return (
            <div
              key={poolIdx}
              className={`border-2 transition-colors ${
                isDragTarget
                  ? 'border-green-fluo bg-green-fluo/5'
                  : tooSmall && poolPairIndices.length > 0
                    ? 'border-warn'
                    : 'border-line'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOverPool(poolIdx) }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverPool(null)
              }}
              onDrop={() => handleDrop(poolIdx)}
            >
              {/* En-tête neutre */}
              <div className="px-3 py-2 flex items-center justify-between bg-bg-strong border-b-2 border-line">
                <span className="font-mono font-bold text-[11px] uppercase tracking-[0.08em] text-ink">
                  Groupe {groupLetter}
                </span>
                <span className="font-mono text-[11px] text-ink-3">
                  {poolPairIndices.length} paire{poolPairIndices.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Paires dans ce groupe */}
              <div
                className={`divide-y divide-line-soft min-h-[48px] ${isDragTarget && poolPairIndices.length === 0 ? 'bg-green-fluo/10' : ''}`}
              >
                {poolPairIndices.map((pairIdx) => {
                  const pair = activePairs[pairIdx]
                  if (!pair) return null
                  const isDragging = dragPairIdx === pairIdx
                  const [aId, bId] = pair
                  const pA = players.find((p) => p.id === aId)
                  const pB = players.find((p) => p.id === bId)
                  return (
                    <div
                      key={pairIdx}
                      draggable
                      onDragStart={() => { setDragPairIdx(pairIdx); setDragOverPool(null) }}
                      onDragEnd={() => { setDragPairIdx(null); setDragOverPool(null) }}
                      className={`flex items-start gap-2 px-2 py-2.5 cursor-grab active:cursor-grabbing select-none transition-opacity
                        ${isDragging ? 'opacity-30' : 'bg-bg hover:bg-bg-alt'}`}
                    >
                      <span className="text-ink-3 flex-shrink-0 mt-0.5" style={{ fontSize: 10, lineHeight: 1 }}>⠿</span>
                      <div className="flex-1 min-w-0">
                        {[{ id: aId, player: pA }, { id: bId, player: pB }].map(({ id, player: p }) => {
                          const letter = p ? data.teamAssignments[p.id] : undefined
                          const idx = letter ? letter.charCodeAt(0) - 65 : -1
                          const color = idx >= 0 ? (TEAM_COLORS[idx] ?? TEAM_COLORS[TEAM_COLORS.length - 1]) : null
                          return (
                            <div key={id} className="flex items-center gap-1.5">
                              {color && <span className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: color.bg }} />}
                              <p className="font-sans text-[12px] text-ink truncate">
                                {p ? playerDisplayName(p) : `#${id}`}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                {poolPairIndices.length === 0 && (
                  <div className={`px-3 py-4 text-center font-sans text-[12px] text-ink-3 italic ${isDragTarget ? 'text-green' : ''}`}>
                    {isDragTarget ? 'Déposer ici' : 'Aucune paire'}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="font-sans text-[11px] text-ink-3">
        Faites glisser une paire vers un autre groupe pour la déplacer. Le bouton "Aléatoire" redistribue toutes les paires de façon aléatoire.
      </p>
    </div>
  )
}

// ─── Step 7 — Composition des équipes doubles ────────────────────────────────

function Step6Composition({ data, players, onChange }: {
  data: WizardData
  players: Player[]
  onChange: (d: Partial<WizardData>) => void
}) {
  const doublesCats = data.categories.filter((c) => DOUBLES_CATS.includes(c))
  const [activeTab, setActiveTab] = useState<MatchCategory>(doublesCats[0] ?? 'DX')
  // Mode de tirage aléatoire : par équipe ou entièrement aléatoire
  const [pairingMode, setPairingMode] = useState<'random' | 'byTeam'>('random')
  const participantPlayers = players.filter((p) => data.selectedPlayerIds.includes(p.id))

  const currentPairs = (data.doublesTeams[activeTab] ?? []) as [number, number][]

  // Couleur d'équipe pour un joueur (mode interclub uniquement)
  const getTeamColor = (playerId: number): { bg: string; text: string } | undefined => {
    if (!data.teamMode) return undefined
    const letter = data.teamAssignments[playerId]
    if (!letter) return undefined
    const idx = letter.charCodeAt(0) - 65
    return TEAM_COLORS[idx] ?? TEAM_COLORS[TEAM_COLORS.length - 1]
  }

  const setPairs = (cat: MatchCategory, pairs: [number, number][]) => {
    onChange({ doublesTeams: { ...data.doublesTeams, [cat]: pairs } })
  }

  const handleShuffle = () => {
    if (pairingMode === 'byTeam' && data.teamMode && data.teamNames.length > 0) {
      setPairs(activeTab, buildTeamPairsW(participantPlayers, activeTab, data.teamAssignments, data.teamNames))
    } else {
      setPairs(activeTab, buildRandomPairsW(participantPlayers, activeTab))
    }
  }

  const addEmptyPair = () => {
    onChange({ doublesTeams: { ...data.doublesTeams, [activeTab]: [...currentPairs, [0, 0]] } })
  }

  const removePair = (idx: number) => {
    setPairs(activeTab, currentPairs.filter((_, i) => i !== idx))
  }

  const removeFromSlot = (pairIdx: number, slot: 0 | 1) => {
    const updated = currentPairs.map((p) => [...p]) as [number, number][]
    updated[pairIdx] = slot === 0 ? [0, updated[pairIdx][1]] : [updated[pairIdx][0], 0]
    setPairs(activeTab, updated)
  }

  // ── Drag & Drop ──────────────────────────────────────────────────────────────
  type DragSource = 'pool' | { pairIdx: number; slot: 0 | 1 }
  type DragOverTarget = { pairIdx: number; slot: 0 | 1 } | 'pool' | null

  const [dragging, setDragging] = useState<{ id: number; source: DragSource } | null>(null)
  const [dragOver, setDragOver] = useState<DragOverTarget>(null)

  const handleDragStart = (e: React.DragEvent, id: number, source: DragSource) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(id))
    setDragging({ id, source })
  }

  const handleDropOnSlot = (e: React.DragEvent, pairIdx: number, slot: 0 | 1) => {
    e.preventDefault()
    if (!dragging) return
    const updated = currentPairs.map((p) => [...p]) as [number, number][]
    const prevOccupant = updated[pairIdx][slot]
    // Place le joueur dragué dans le slot cible
    if (slot === 0) updated[pairIdx][0] = dragging.id
    else updated[pairIdx][1] = dragging.id
    // Si la source était un slot, y place l'ancien occupant (échange)
    if (dragging.source !== 'pool') {
      const { pairIdx: srcIdx, slot: srcSlot } = dragging.source
      // Évite l'auto-échange sur le même slot
      if (srcIdx !== pairIdx || srcSlot !== slot) {
        if (srcSlot === 0) updated[srcIdx][0] = prevOccupant
        else updated[srcIdx][1] = prevOccupant
      }
    }
    setPairs(activeTab, updated)
    setDragging(null)
    setDragOver(null)
  }

  const handleDropOnPool = (e: React.DragEvent) => {
    e.preventDefault()
    if (!dragging || dragging.source === 'pool') return
    removeFromSlot(dragging.source.pairIdx, dragging.source.slot)
    setDragging(null)
    setDragOver(null)
  }

  const isSlotTarget = (pairIdx: number, slot: 0 | 1): boolean =>
    typeof dragOver === 'object' && dragOver !== null &&
    dragOver.pairIdx === pairIdx && dragOver.slot === slot

  // IDs assignés dans cette catégorie
  const assignedIds = new Set(currentPairs.flatMap(([a, b]) => [a, b].filter((x) => x > 0)))

  // Pool par genre pour DX, sinon pool global filtré par genre de la cat
  const poolFor = (slot: 0 | 1) =>
    eligibleForSlotW(activeTab, slot, participantPlayers).filter((p) => !assignedIds.has(p.id))
  const poolMen   = activeTab === 'DX' ? poolFor(0) : []
  const poolWomen = activeTab === 'DX' ? poolFor(1) : []
  const poolAll   = activeTab !== 'DX' ? poolFor(0) : []

  const validPairs = currentPairs.filter(([a, b]) => a > 0 && b > 0 && a !== b)

  if (doublesCats.length === 0) {
    return (
      <p className="font-sans text-[14px] text-ink-3">
        Aucune discipline double sélectionnée (DH, DD ou DX). Retournez à l'étape Format.
      </p>
    )
  }

  const slotHint = (slot: 0 | 1) => {
    if (activeTab === 'DX') return slot === 0 ? 'Joueur (H)' : 'Joueuse (F)'
    if (activeTab === 'DH') return slot === 0 ? 'Joueur 1 (H)' : 'Joueur 2 (H)'
    return slot === 0 ? 'Joueuse 1 (F)' : 'Joueuse 2 (F)'
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Barre d'outils : description + toggle + onglets catégories + tirage ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="font-sans text-[13px] text-ink-3">
          Constituez les paires par glisser-déposer.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle mode de tirage — affiché uniquement en mode interclub */}
          {data.teamMode && data.teamNames.length > 0 && (
            <div className="flex gap-0 border-2 border-line">
              {(['random', 'byTeam'] as const).map((mode) => (
                <button key={mode} onClick={() => setPairingMode(mode)}
                  className={`px-3 py-1.5 font-mono font-bold text-[10px] uppercase tracking-[0.08em] transition-colors
                    ${pairingMode === mode ? 'bg-ink text-green-fluo' : 'bg-bg text-ink-3 hover:text-ink'}`}>
                  {mode === 'random' ? 'Aléatoire' : 'Par équipe'}
                </button>
              ))}
            </div>
          )}
          {/* Bouton tirage au sort — déplacé ici sous le toggle */}
          <button onClick={handleShuffle}
            className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-line hover:border-blue text-[10px]
              font-mono font-bold uppercase tracking-[0.06em] text-ink hover:text-blue transition-colors min-h-[36px]">
            <Shuffle size={11} /> Tirer au sort
          </button>
        </div>
        {doublesCats.length > 1 && (
          <div className="flex gap-0 border-2 border-line">
            {doublesCats.map((cat) => {
              const pairs = (data.doublesTeams[cat] ?? []) as [number, number][]
              const valid = pairs.filter(([a, b]) => a > 0 && b > 0 && a !== b).length
              return (
                <button key={cat} onClick={() => setActiveTab(cat)}
                  className={`px-4 py-2 font-mono font-bold text-[11px] uppercase tracking-[0.08em] transition-colors
                    ${activeTab === cat ? 'bg-ink text-green-fluo' : 'bg-bg text-ink-3 hover:text-ink'}`}>
                  {cat}
                  {valid > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 font-bold text-[9px]"
                      style={{ backgroundColor: '#00C24A', color: '#fff' }}>{valid}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Indication genre + compteur */}
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3 -mt-2">
        {activeTab === 'DH' && 'Paires Hommes — H + H'}
        {activeTab === 'DD' && 'Paires Dames — F + F'}
        {activeTab === 'DX' && 'Mixte — Homme + Femme'}
        {' '}· {validPairs.length} paire{validPairs.length !== 1 ? 's' : ''} valide{validPairs.length !== 1 ? 's' : ''}
      </p>

      {/* ── Layout principal : pool gauche + paires droite ── */}
      <div className="flex gap-6 items-start">

        {/* Pool gauche — zone de dépôt pour retirer un joueur d'une paire */}
        <div
          className={`w-[220px] shrink-0 flex flex-col gap-3 p-2 transition-colors
            ${dragOver === 'pool' ? 'bg-bg-alt outline outline-2 outline-dashed outline-line-soft' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver('pool') }}
          onDragLeave={() => setDragOver(null)}
          onDrop={handleDropOnPool}
        >
          <span className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3">
            Disponibles
          </span>

          {activeTab === 'DX' ? (
            /* Pool split H / F pour mixte */
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-mono font-bold text-blue tracking-[0.06em]">HOMMES</span>
                {poolMen.length === 0
                  ? <p className="text-[11px] font-sans text-ink-3 italic px-1">Tous assignés</p>
                  : poolMen.map((p) => (
                    <div key={p.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, p.id, 'pool')}
                      onDragEnd={() => { setDragging(null); setDragOver(null) }}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <PlayerMiniCard player={p} teamColor={getTeamColor(p.id)} />
                    </div>
                  ))
                }
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-mono font-bold tracking-[0.06em]" style={{ color: '#00C24A' }}>FEMMES</span>
                {poolWomen.length === 0
                  ? <p className="text-[11px] font-sans text-ink-3 italic px-1">Toutes assignées</p>
                  : poolWomen.map((p) => (
                    <div key={p.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, p.id, 'pool')}
                      onDragEnd={() => { setDragging(null); setDragOver(null) }}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <PlayerMiniCard player={p} teamColor={getTeamColor(p.id)} />
                    </div>
                  ))
                }
              </div>
            </div>
          ) : (
            /* Pool unique pour DH / DD */
            <div className="flex flex-col gap-1.5">
              {poolAll.length === 0
                ? <p className="text-[11px] font-sans text-ink-3 italic px-1">Tous assignés</p>
                : poolAll.map((p) => (
                  <div key={p.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, p.id, 'pool')}
                    onDragEnd={() => { setDragging(null); setDragOver(null) }}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <PlayerMiniCard player={p} teamColor={getTeamColor(p.id)} />
                  </div>
                ))
              }
            </div>
          )}
        </div>

        {/* ── Paires droite ── */}
        <div className="flex-1 flex flex-col gap-3">
          <span className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3">Paires</span>

          {currentPairs.length === 0 && (
            <p className="font-sans text-[13px] text-ink-3">
              Aucune paire. Cliquez sur « Tirer au sort » ou ajoutez une paire manuellement.
            </p>
          )}

          {currentPairs.map((pair, pairIdx) => {
            const playerA = players.find((p) => p.id === pair[0])
            const playerB = players.find((p) => p.id === pair[1])
            return (
              <div key={pairIdx} className="flex items-stretch gap-2">
                {/* Numéro */}
                <span className="font-mono text-[11px] text-ink-3 w-5 shrink-0 text-right pt-5">{pairIdx + 1}</span>

                {/* Slot 0 — zone de dépôt */}
                <div className="flex-1"
                  onDragOver={(e) => { e.preventDefault(); setDragOver({ pairIdx, slot: 0 }) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => handleDropOnSlot(e, pairIdx, 0)}
                  style={isSlotTarget(pairIdx, 0) ? { outline: '2px solid #0047FF', outlineOffset: '1px' } : {}}
                >
                  {playerA ? (
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, playerA.id, { pairIdx, slot: 0 })}
                      onDragEnd={() => { setDragging(null); setDragOver(null) }}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <PlayerMiniCard player={playerA}
                        onRemove={() => removeFromSlot(pairIdx, 0)}
                        teamColor={getTeamColor(playerA.id)}
                      />
                    </div>
                  ) : (
                    <PlayerMiniCard placeholder={slotHint(0)} />
                  )}
                </div>

                {/* Séparateur */}
                <div className="flex items-center shrink-0">
                  <span className="font-mono font-bold text-[11px] text-ink-3">+</span>
                </div>

                {/* Slot 1 — zone de dépôt */}
                <div className="flex-1"
                  onDragOver={(e) => { e.preventDefault(); setDragOver({ pairIdx, slot: 1 }) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => handleDropOnSlot(e, pairIdx, 1)}
                  style={isSlotTarget(pairIdx, 1) ? { outline: '2px solid #0047FF', outlineOffset: '1px' } : {}}
                >
                  {playerB ? (
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, playerB.id, { pairIdx, slot: 1 })}
                      onDragEnd={() => { setDragging(null); setDragOver(null) }}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <PlayerMiniCard player={playerB}
                        onRemove={() => removeFromSlot(pairIdx, 1)}
                        teamColor={getTeamColor(playerB.id)}
                      />
                    </div>
                  ) : (
                    <PlayerMiniCard placeholder={slotHint(1)} />
                  )}
                </div>

                {/* Supprimer paire */}
                <button onClick={() => removePair(pairIdx)}
                  className="shrink-0 w-8 flex items-center justify-center text-ink-3 hover:text-red transition-colors border-2 border-transparent hover:border-red">
                  <X size={13} />
                </button>
              </div>
            )
          })}

          <button onClick={addEmptyPair}
            className="flex items-center gap-1.5 mt-1 py-2 px-3 border-2 border-dashed border-line-soft hover:border-blue
              font-sans font-bold text-[12px] text-ink-3 hover:text-blue transition-colors self-start">
            <Plus size={12} /> Ajouter une paire vide
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Wizard principal ─────────────────────────────────────────────────────────

export function TournamentWizard() {
  const navigate = useNavigate()
  const { createTournament } = useTournamentsStore()
  const { players, fetchPlayers } = usePlayersStore()
  const { rules, fetchRules } = useRulesStore()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardData>(INITIAL)
  const [saving, setSaving] = useState(false)
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)

  // Step 6 (Poules) uniquement en mode pool+knockout hors mode équipes
  // Step 7 (Composition) visible uniquement si des catégories doubles sont sélectionnées
  const hasDoublesCats = data.categories.some((c) => DOUBLES_CATS.includes(c))
  const hasPoolFormat = data.format === 'pool+knockout'
  const STEPS = BASE_STEPS.filter((s) => {
    if (s.id === 6) return hasPoolFormat
    if (s.id === 7) return hasDoublesCats
    return true
  })

  const stepIds = STEPS.map((s) => s.id)
  const currentStepIdx = stepIds.indexOf(step)
  const totalSteps = STEPS.length

  useEffect(() => {
    void fetchPlayers()
    void fetchRules()
    // Pré-sélectionne la première règle disponible
    if (rules.length > 0 && !data.scoringRuleId) {
      setData((d) => ({ ...d, scoringRuleId: rules[0].id }))
    }
  }, [fetchPlayers, fetchRules])

  useEffect(() => {
    if (rules.length > 0 && !data.scoringRuleId) {
      setData((d) => ({ ...d, scoringRuleId: rules[0].id }))
    }
  }, [rules])

  const findRuleByNames = (ruleNames: string[]): ScoringRule | undefined => {
    const normalize = (v: string) => v.toLowerCase().replace(/\s+/g, ' ').trim()
    const wanted = ruleNames.map(normalize)
    return rules.find((rule) => wanted.includes(normalize(rule.name)))
  }

  const applyModel = (modelId: string) => {
    const model = TOURNAMENT_MODELS.find((m) => m.id === modelId)
    if (!model) return
    const matchedRule = findRuleByNames(model.scoringRuleNames)
    setData((prev) => ({
      ...prev,
      format: model.format,
      categories: model.categories,
      poolCount: model.poolCount,
      scoringRuleId: matchedRule ? matchedRule.id : prev.scoringRuleId,
    }))
    setSelectedModelId(model.id)
  }

  const update = (partial: Partial<WizardData>) => setData((d) => ({ ...d, ...partial }))

  const canNext = () => {
    if (step === 1) return data.name.trim().length > 0
    if (step === 2) return data.selectedPlayerIds.length >= 2
    if (step === 3) return true  // Équipes — toggle optionnel
    if (step === 4) {            // Format — vérifie compatibilité avec le nb de joueurs
      const n = data.selectedPlayerIds.length
      if (data.format === 'round-robin'   && n < 3) return false
      if (data.format === 'americano'     && n < 4) return false
      if (data.format === 'swiss'         && n < 4) return false
      if (data.format === 'king-of-court' && n < 4) return false
      if (data.format === 'pool+knockout' && n < data.poolCount * 3) return false
      return true
    }
    if (step === 5) return true  // Règles
    if (step === 6) return true  // Poules — avertissement informatif seulement
    if (step === 7) return true  // Composition — optionnel
    return false
  }

  const handleFinish = async () => {
    setSaving(true)
    try {
      const tournament = await createTournament({
        name: data.name,
        date: data.date,
        location: data.location || undefined,
        courtCount: data.courtCount,
        poolCount: data.poolCount,
        format: data.format,
        status: 'draft',
        scoringRuleId: data.scoringRuleId ?? undefined,
        categories: data.categories,
        // Les équipes du Step ÉQUIPE sont des labels d'identification uniquement —
        // teamMode reste 0 pour ne pas déclencher la génération interclub.
        teamMode: 0,
        teamAName: data.teamMode ? (data.teamNames[0] ?? undefined) : undefined,
        teamBName: data.teamMode ? (data.teamNames[1] ?? undefined) : undefined,
        teamNames: data.teamMode ? data.teamNames : undefined,
      })
      // Inscrit chaque joueur sélectionné au tournoi + teamSide si mode équipes
      const enrollments = await Promise.all(
        data.selectedPlayerIds.map((playerId) =>
          window.db.addPlayerToTournament(tournament.id, playerId)
        )
      )
      if (data.teamMode) {
        // enrollments[i] est un TournamentPlayer avec id
        for (let i = 0; i < data.selectedPlayerIds.length; i++) {
          const playerId = data.selectedPlayerIds[i]
          const side = data.teamAssignments[playerId] ?? null
          const tp = enrollments[i] as { id: number } | null
          if (tp?.id && side) {
            await window.db.setPlayerTeamSide(tp.id, side)
          }
        }
      }
      navigate(`/tournaments/${tournament.id}`, {
        state: {
          doublesTeams: data.doublesTeams,
          // Poules singles : uniquement si pas de catégories doubles
          poolAssignments: hasPoolFormat && !hasDoublesCats ? data.poolAssignments : undefined,
          // Poules doubles : indices de paires par catégorie
          doublesPoolAssignments: hasPoolFormat && hasDoublesCats ? data.doublesPoolAssignments : undefined,
          autoGenerate: true,
        },
      })
    } finally {
      setSaving(false)
    }
  }

  const selectedPlayers = players.filter((p) => data.selectedPlayerIds.includes(p.id))
  const selectedRule = rules.find((r) => r.id === data.scoringRuleId)

  return (
    <div className="flex h-full">
      {/* Zone gauche 60% */}
      <div className="flex-[3] overflow-y-auto scrollbar-light border-r-2 border-line p-8">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="font-sans font-black uppercase text-[42px] tracking-[-0.03em] text-ink leading-none">
            Nouveau tournoi
          </h1>
          <p className="font-sans text-[14px] text-ink-3 mt-2">
            Étape {currentStepIdx + 1} sur {totalSteps} — {STEPS[currentStepIdx].label}
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-0 mb-10">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const active = i === currentStepIdx
            const done = i < currentStepIdx
            return (
              <div key={s.id} className="flex items-center">
                <div className={`flex items-center gap-2 px-4 py-2 border-2 transition-colors
                  ${active ? 'border-blue bg-blue text-white' :
                    done ? 'border-green bg-green text-white' :
                    'border-line bg-bg text-ink-3'}`}>
                  <Icon size={12} />
                  <span className="text-[11px] font-mono font-bold uppercase tracking-[0.08em]">
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-6 h-0.5 ${done ? 'bg-green' : 'bg-line-soft'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Contenu étape */}
        <div className={step === 6 || step === 7 ? '' : 'max-w-xl'}>
          {step === 1 && (
            <Step1
              data={data}
              onChange={update}
              onApplyModel={applyModel}
              selectedModelId={selectedModelId}
            />
          )}
          {step === 2 && <Step2 data={data} players={players} onChange={update} />}
          {step === 3 && <Step3Teams data={data} players={players} onChange={update} />}
          {step === 4 && <Step3 data={data} onChange={update} />}
          {step === 5 && <Step4 data={data} rules={rules} onChange={update} />}
          {step === 6 && <StepPools data={data} players={players} onChange={update} />}
          {step === 7 && <Step6Composition data={data} players={players} onChange={update} />}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-10 pt-6 border-t-2 border-line max-w-xl">
          <Button variant="secondary"
            onClick={() => {
              if (currentStepIdx > 0) setStep(stepIds[currentStepIdx - 1])
              else navigate('/tournaments')
            }}
          >
            <ChevronLeft size={14} className="mr-1 inline" />
            {currentStepIdx === 0 ? 'Annuler' : 'Retour'}
          </Button>

          {currentStepIdx < totalSteps - 1 ? (
            <Button disabled={!canNext()} onClick={() => setStep(stepIds[currentStepIdx + 1])}>
              Suivant
              <ChevronRight size={14} className="ml-1 inline" />
            </Button>
          ) : (
            <Button disabled={saving || !canNext()} onClick={handleFinish}>
              {saving ? 'Création…' : 'Créer le tournoi'}
            </Button>
          )}
        </div>
      </div>

      {/* Zone droite 40% — aperçu */}
      <div className="flex-[2] bg-bg-alt sticky top-0 h-full overflow-y-auto scrollbar-light">
        <TournamentPreview data={data} selectedPlayers={selectedPlayers} selectedRule={selectedRule} />
      </div>
    </div>
  )
}
