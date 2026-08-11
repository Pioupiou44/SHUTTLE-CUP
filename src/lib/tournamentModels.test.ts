import { describe, it, expect } from 'vitest'
import { modelStillMatchesConfig, resolveRuleByNames, TOURNAMENT_MODELS } from '@/lib/tournamentModels'
import type { ScoringRule } from '@/types/domain'

describe('tournamentModels helpers', () => {
  it('trouve une regle par nom prefere en mode tolerant a la casse et espaces', () => {
    const rules: Pick<ScoringRule, 'id' | 'name'>[] = [
      { id: 1, name: 'BWF Standard 3×21' },
      { id: 2, name: '  format   club 2×15 (rapide) ' },
    ]

    const result = resolveRuleByNames(rules, ['Format club 2×15 (rapide)'])
    expect(result?.id).toBe(2)
  })

  it('retourne undefined si aucune regle ne correspond', () => {
    const rules: Pick<ScoringRule, 'id' | 'name'>[] = [
      { id: 1, name: 'BWF Standard 3×21' },
    ]

    const result = resolveRuleByNames(rules, ['Set unique 15 points'])
    expect(result).toBeUndefined()
  })

  it('respecte l ordre des noms preferes quand plusieurs regles existent', () => {
    const rules: Pick<ScoringRule, 'id' | 'name'>[] = [
      { id: 1, name: 'BWF Standard 3×21' },
      { id: 2, name: 'BWF 3×15 (à partir de 2027)' },
    ]

    const result = resolveRuleByNames(rules, ['BWF 3×15 (à partir de 2027)', 'BWF Standard 3×21'])
    expect(result?.id).toBe(2)
  })

  it('considere un modele conforme quand format, poules et categories matchent', () => {
    const model = TOURNAMENT_MODELS.find((m) => m.id === 'officiel-bwf')
    expect(model).toBeDefined()

    const sameConfig = {
      format: 'pool+knockout' as const,
      poolCount: 2,
      categories: ['DX', 'SH', 'DD', 'DH', 'SD'] as const,
    }

    expect(modelStillMatchesConfig(sameConfig, model!)).toBe(true)
  })

  it('invalide le modele si le format diverge', () => {
    const model = TOURNAMENT_MODELS.find((m) => m.id === 'officiel-bwf')
    expect(model).toBeDefined()

    const changedConfig = {
      format: 'round-robin' as const,
      poolCount: 2,
      categories: ['SH', 'SD', 'DH', 'DD', 'DX'] as const,
    }

    expect(modelStillMatchesConfig(changedConfig, model!)).toBe(false)
  })
})
