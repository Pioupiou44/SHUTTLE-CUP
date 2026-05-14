import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTournamentsStore } from '@/store/tournamentsStore'
import { usePlayersStore } from '@/store/playersStore'
import { useRulesStore } from '@/store/rulesStore'
import { Button, Input, Tag, Badge } from '@/components/ui'
import { ChevronRight, ChevronLeft, Users, Trophy, Settings, AlignLeft } from 'lucide-react'
import { playerDisplayName, FORMAT_LABELS, CATEGORY_LABELS } from '@/types/domain'
import { countRoundRobinMatches, estimateDuration } from '@/engine/generators/roundRobin'
import { nextPowerOf2 } from '@/engine/generators/singleElim'
import { countPoolKnockoutMatches } from '@/engine/generators/poolPlusKnockout'
import type { TournamentFormat, MatchCategory } from '@/types/domain'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WizardData {
  // Étape 1 — Infos
  name: string
  date: string
  location: string
  courtCount: number
  // Étape 2 — Joueurs
  selectedPlayerIds: number[]
  // Étape 3 — Format
  format: TournamentFormat
  categories: MatchCategory[]
  poolCount: number
  // Étape 4 — Règles
  scoringRuleId: number | null
}

const INITIAL: WizardData = {
  name: '',
  date: new Date().toISOString().slice(0, 10),
  location: '',
  courtCount: 2,
  selectedPlayerIds: [],
  format: 'round-robin',
  categories: [],
  poolCount: 2,
  scoringRuleId: null,
}

const FORMAT_OPTIONS: { value: TournamentFormat; label: string }[] = [
  { value: 'round-robin',        label: 'Poules — Round Robin' },
  { value: 'knockout',           label: 'Élimination directe' },
  { value: 'double-elimination', label: 'Double élimination' },
  { value: 'pool+knockout',      label: 'Poules + Élimination (recommandé)' },
  { value: 'americano',          label: 'Américano' },
  { value: 'swiss',              label: 'Système suisse' },
  { value: 'king-of-court',      label: 'Roi du court' },
]

const STEPS = [
  { id: 1, label: 'Infos',    icon: AlignLeft },
  { id: 2, label: 'Joueurs',  icon: Users },
  { id: 3, label: 'Format',   icon: Trophy },
  { id: 4, label: 'Règles',   icon: Settings },
]

// ─── Aperçu live (côté droit) ─────────────────────────────────────────────────

function TournamentPreview({ data, playerNames, ruleName }: {
  data: WizardData
  playerNames: Map<number, string>
  ruleName: string
}) {
  const n = data.selectedPlayerIds.length
  const courts = data.courtCount

  let matchCount = 0
  let duration = 0
  let bracketInfo = ''

  if (data.format === 'round-robin') {
    matchCount = countRoundRobinMatches(n)
    duration = estimateDuration(n, courts)
    bracketInfo = `${matchCount} matchs, ${Math.ceil(n / 2)} rondes max`
  } else if (data.format === 'knockout' || data.format === 'double-elimination') {
    const size = n > 0 ? nextPowerOf2(n) : 0
    matchCount = size > 0 ? size - 1 : 0
    duration = Math.ceil(matchCount / courts) * 20
    bracketInfo = `Bracket ${size > 0 ? size : '?'} — ${size - n} bye${size - n !== 1 ? 's' : ''}`
  } else if (data.format === 'pool+knockout') {
    matchCount = n > 1 ? countPoolKnockoutMatches(n, data.poolCount) : 0
    duration = Math.ceil(matchCount / courts) * 20
    bracketInfo = `${data.poolCount} groupes — ${n > 0 ? Math.ceil(n / data.poolCount) : '?'} joueurs/groupe`
  } else {
    matchCount = n > 0 ? Math.ceil(n / 2) * 3 : 0
    duration = Math.ceil(matchCount / courts) * 20
    bracketInfo = 'Estimation'
  }

  return (
    <div className="p-8 flex flex-col gap-8 h-full">
      {/* Nom */}
      <div>
        <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-1">Tournoi</p>
        <p className="font-sans font-black uppercase text-[30px] tracking-[-0.02em] text-ink leading-none">
          {data.name || '—'}
        </p>
        {data.date && (
          <p className="font-sans text-[13px] text-ink-3 mt-1">
            {new Date(data.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            {data.location ? ` · ${data.location}` : ''}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Joueurs',   value: String(n || '—') },
          { label: 'Terrains',  value: String(courts) },
          { label: 'Matchs est.', value: matchCount > 0 ? String(matchCount) : '—' },
          { label: 'Durée est.', value: duration > 0 ? `${duration} min` : '—' },
        ].map((s) => (
          <div key={s.label}>
            <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3">{s.label}</p>
            <p className="font-sans font-black text-[28px] tracking-[-0.03em] text-ink leading-none mt-0.5">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Format + info bracket */}
      <div>
        <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-2">Format</p>
        <Badge variant="active">{FORMAT_OPTIONS.find(f => f.value === data.format)?.label ?? data.format}</Badge>
        {bracketInfo && (
          <p className="font-sans text-[12px] text-ink-3 mt-2">{bracketInfo}</p>
        )}
        {data.categories.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-2">
            {data.categories.map((c) => (
              <span key={c} className="text-[10px] font-mono font-bold px-2 py-1 bg-ink text-green-fluo">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Règle */}
      {ruleName && (
        <div>
          <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-1">Règle de scoring</p>
          <p className="font-sans font-bold text-[15px] text-ink">{ruleName}</p>
        </div>
      )}

      {/* Joueurs sélectionnés */}
      {n > 0 && (
        <div>
          <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-2">
            Participants ({n})
          </p>
          <div className="flex flex-wrap gap-2">
            {data.selectedPlayerIds.slice(0, 12).map((id) => (
              <span key={id} className="text-[11px] font-mono font-bold text-ink bg-bg-strong px-2 py-1">
                {playerNames.get(id) ?? `#${id}`}
              </span>
            ))}
            {n > 12 && (
              <span className="text-[11px] font-mono text-ink-3 px-2 py-1">+{n - 12}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Étapes ───────────────────────────────────────────────────────────────────

function Step1({ data, onChange }: { data: WizardData; onChange: (d: Partial<WizardData>) => void }) {
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
      <Input label="Nombre de terrains" type="number" min={1} max={20}
        value={String(data.courtCount)} onChange={(e) => onChange({ courtCount: Number(e.target.value) })} />
    </div>
  )
}

function Step2({ data, players, onChange }: {
  data: WizardData
  players: ReturnType<typeof usePlayersStore.getState>['players']
  onChange: (d: Partial<WizardData>) => void
}) {
  const [search, setSearch] = useState('')
  const activePlayers = players.filter((p) => p.status === 'active')
  const filtered = search
    ? activePlayers.filter((p) => playerDisplayName(p).toLowerCase().includes(search.toLowerCase()))
    : activePlayers

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
      <input type="text" placeholder="Rechercher…" value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="bg-bg border border-line hover:border-blue focus:border-blue px-3 py-2
          w-full min-h-[44px] font-sans text-[14px] outline-none placeholder:text-ink-3" />
      <div className="max-h-72 overflow-y-auto scrollbar-light border-2 border-line">
        {filtered.map((p, i) => {
          const selected = data.selectedPlayerIds.includes(p.id)
          return (
            <div key={p.id}
              onClick={() => toggle(p.id)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-line-soft
                transition-colors ${selected ? 'bg-blue/10' : i % 2 === 0 ? 'bg-bg' : 'bg-bg-alt'}
                hover:bg-bg-strong`}
            >
              <div className={`w-4 h-4 border-2 flex items-center justify-center shrink-0
                ${selected ? 'bg-blue border-blue' : 'border-line'}`}>
                {selected && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
              </div>
              <div className="flex-1">
                <span className="font-sans font-bold text-[14px] text-ink">{playerDisplayName(p)}</span>
                <span className="font-mono text-[11px] text-ink-3 ml-2">{p.level}</span>
              </div>
              <Tag label={p.gender} color={p.gender === 'M' ? 'H' : 'F'} />
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-center font-sans text-[14px] text-ink-3">
            Aucun joueur actif trouvé
          </p>
        )}
      </div>
    </div>
  )
}

function Step3({ data, onChange }: { data: WizardData; onChange: (d: Partial<WizardData>) => void }) {
  const toggleCategory = (cat: MatchCategory) => {
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
            onClick={() => onChange({ format: opt.value })}
            className={`px-4 py-3 border-2 cursor-pointer transition-colors
              ${data.format === opt.value ? 'border-blue bg-blue/5' : 'border-line hover:border-blue/50 bg-bg'}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-sans font-bold text-[14px] text-ink">{opt.label}</span>
              {data.format === opt.value && <Badge variant="active">Sélectionné</Badge>}
            </div>
            <p className="font-sans text-[12px] text-ink-3 mt-0.5">{FORMAT_LABELS[opt.value]}</p>
          </div>
        ))}
      </div>

      {/* Nombre de groupes (pool+knockout uniquement) */}
      {data.format === 'pool+knockout' && (
        <div>
          <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-2">
            Nombre de groupes
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
      )}

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

// ─── Wizard principal ─────────────────────────────────────────────────────────

export function TournamentWizard() {
  const navigate = useNavigate()
  const { createTournament } = useTournamentsStore()
  const { players, fetchPlayers } = usePlayersStore()
  const { rules, fetchRules } = useRulesStore()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardData>(INITIAL)
  const [saving, setSaving] = useState(false)

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

  const update = (partial: Partial<WizardData>) => setData((d) => ({ ...d, ...partial }))

  const canNext = () => {
    if (step === 1) return data.name.trim().length > 0
    if (step === 2) return data.selectedPlayerIds.length >= 2
    if (step === 3) return true
    if (step === 4) return true
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
        format: data.format,
        status: 'draft',
        scoringRuleId: data.scoringRuleId ?? undefined,
        categories: data.categories,
      })
      // Inscrit chaque joueur sélectionné au tournoi
      await Promise.all(
        data.selectedPlayerIds.map((playerId) =>
          window.db.addPlayerToTournament(tournament.id, playerId)
        )
      )
      navigate(`/tournaments/${tournament.id}`)
    } finally {
      setSaving(false)
    }
  }

  const playerNames = new Map(players.map((p) => [p.id, playerDisplayName(p)]))
  const ruleName = rules.find((r) => r.id === data.scoringRuleId)?.name ?? ''

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
            Étape {step} sur {STEPS.length} — {STEPS[step - 1].label}
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-0 mb-10">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const active = s.id === step
            const done = s.id < step
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
        <div className="max-w-xl">
          {step === 1 && <Step1 data={data} onChange={update} />}
          {step === 2 && <Step2 data={data} players={players} onChange={update} />}
          {step === 3 && <Step3 data={data} onChange={update} />}
          {step === 4 && <Step4 data={data} rules={rules} onChange={update} />}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-10 pt-6 border-t-2 border-line max-w-xl">
          <Button variant="secondary"
            onClick={() => step > 1 ? setStep(step - 1) : navigate('/tournaments')}
          >
            <ChevronLeft size={14} className="mr-1 inline" />
            {step === 1 ? 'Annuler' : 'Retour'}
          </Button>

          {step < STEPS.length ? (
            <Button disabled={!canNext()} onClick={() => setStep(step + 1)}>
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
        <TournamentPreview data={data} playerNames={playerNames} ruleName={ruleName} />
      </div>
    </div>
  )
}
