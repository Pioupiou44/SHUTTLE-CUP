import type { MatchCategory, ScoringRule, TournamentFormat } from '@/types/domain'

export type TournamentModelDef = {
  id: string
  label: string
  description: string
  format: TournamentFormat
  categories: MatchCategory[]
  poolCount: number
  scoringRuleNames: string[]
  minPlayers: number
  maxPlayers: number
  recommendedCourts: number
}

export const TOURNAMENT_MODELS: TournamentModelDef[] = [
  {
    id: 'club-rapide',
    label: 'Tournoi club rapide',
    description: 'Format court pour soirée club : rounds fluides et score 2×15.',
    format: 'round-robin',
    categories: ['SH', 'SD'],
    poolCount: 2,
    scoringRuleNames: ['Format club 2×15 (rapide)', 'BWF 3×15 (à partir de 2027)'],
    minPlayers: 6,
    maxPlayers: 12,
    recommendedCourts: 2,
  },
  {
    id: 'officiel-bwf',
    label: 'Championnat officiel',
    description: 'Structure poules + finale avec règle BWF officielle.',
    format: 'pool+knockout',
    categories: ['SH', 'SD', 'DH', 'DD', 'DX'],
    poolCount: 2,
    scoringRuleNames: ['BWF 3×15 (à partir de 2027)', 'BWF Standard 3×21'],
    minPlayers: 12,
    maxPlayers: 32,
    recommendedCourts: 4,
  },
  {
    id: 'poules-finale',
    label: 'Poules + finale club',
    description: 'Chaque joueur joue plusieurs matchs avant la phase finale.',
    format: 'pool+knockout',
    categories: ['SH', 'SD', 'DH'],
    poolCount: 2,
    scoringRuleNames: ['BWF Standard 3×21', 'Set unique 21 points'],
    minPlayers: 10,
    maxPlayers: 24,
    recommendedCourts: 3,
  },
  {
    id: 'open-mixte',
    label: 'Format simple / double / mixte',
    description: 'Modèle polyvalent pour tournoi multi-disciplines.',
    format: 'americano',
    categories: ['DH', 'DD', 'DX'],
    poolCount: 2,
    scoringRuleNames: ['Set unique 15 points', 'Set unique 21 points'],
    minPlayers: 8,
    maxPlayers: 24,
    recommendedCourts: 3,
  },
]

type ModelMatchConfig = {
  format: TournamentFormat
  categories: readonly MatchCategory[]
  poolCount: number
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function hasSameCategories(a: readonly MatchCategory[], b: readonly MatchCategory[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

export function modelStillMatchesConfig(config: ModelMatchConfig, model: TournamentModelDef): boolean {
  return config.format === model.format
    && config.poolCount === model.poolCount
    && hasSameCategories(config.categories, model.categories)
}

export function resolveRuleByNames(
  rules: Pick<ScoringRule, 'id' | 'name'>[],
  preferredNames: string[]
): Pick<ScoringRule, 'id' | 'name'> | undefined {
  const byName = new Map(rules.map((rule) => [normalizeName(rule.name), rule]))
  for (const preferredName of preferredNames) {
    const match = byName.get(normalizeName(preferredName))
    if (match) return match
  }
  return undefined
}
