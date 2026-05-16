/**
 * Tests unitaires — générateur Poules + Élimination directe
 * Couvre : splitIntoPools, generatePoolPlusKnockout
 */

import { describe, it, expect } from 'vitest'
import {
  splitIntoPools,
  generatePoolPlusKnockout,
} from '@/engine/generators/poolPlusKnockout'

// ─── splitIntoPools ───────────────────────────────────────────────────────────

describe('splitIntoPools', () => {
  it('répartit 6 joueurs en 2 poules de 3 (serpentin)', () => {
    const pools = splitIntoPools([1, 2, 3, 4, 5, 6], 2)
    // serpentin : 0→pool0, 1→pool1, 2→pool0, 3→pool1, 4→pool0, 5→pool1
    expect(pools[0]).toEqual([1, 3, 5])
    expect(pools[1]).toEqual([2, 4, 6])
  })

  it('répartit 4 joueurs en 2 poules de 2 (serpentin)', () => {
    const pools = splitIntoPools([1, 2, 3, 4], 2)
    expect(pools[0]).toEqual([1, 3])
    expect(pools[1]).toEqual([2, 4])
  })

  it('répartit 9 joueurs en 3 poules (serpentin)', () => {
    const pools = splitIntoPools([1, 2, 3, 4, 5, 6, 7, 8, 9], 3)
    expect(pools[0]).toEqual([1, 4, 7])
    expect(pools[1]).toEqual([2, 5, 8])
    expect(pools[2]).toEqual([3, 6, 9])
  })

  it('retourne le bon nombre de poules', () => {
    const pools = splitIntoPools([1, 2, 3, 4, 5, 6], 3)
    expect(pools).toHaveLength(3)
  })

  it('tous les joueurs sont présents dans une seule poule', () => {
    const playerIds = [10, 20, 30, 40, 50, 60]
    const pools = splitIntoPools(playerIds, 2)
    const allInPools = pools.flat().sort((a, b) => a - b)
    expect(allInPools).toEqual([...playerIds].sort((a, b) => a - b))
  })

  it('chaque joueur apparaît dans exactement une poule', () => {
    const playerIds = [1, 2, 3, 4, 5, 6]
    const pools = splitIntoPools(playerIds, 2)
    const allInPools = pools.flat()
    expect(new Set(allInPools).size).toBe(playerIds.length)
  })

  it('retourne des tableaux vides si aucun joueur', () => {
    const pools = splitIntoPools([], 2)
    expect(pools).toHaveLength(2)
    expect(pools[0]).toHaveLength(0)
    expect(pools[1]).toHaveLength(0)
  })
})

// ─── generatePoolPlusKnockout ─────────────────────────────────────────────────

describe('generatePoolPlusKnockout', () => {
  it('retourne les 3 propriétés requises (poolMatches, knockoutMatches, pools)', () => {
    const result = generatePoolPlusKnockout([1, 2, 3, 4], {
      tournamentId: 1,
      courtCount: 2,
      poolCount: 2,
    })
    expect(result).toHaveProperty('poolMatches')
    expect(result).toHaveProperty('knockoutMatches')
    expect(result).toHaveProperty('pools')
  })

  it('génère 2 poolMatches pour 4 joueurs en 2 poules de 2 (1 match par poule)', () => {
    // 2 poules de 2 joueurs → chaque poule a C(2,2)=1 match → 2 poolMatches
    const result = generatePoolPlusKnockout([1, 2, 3, 4], {
      tournamentId: 1,
      courtCount: 2,
      poolCount: 2,
    })
    expect(result.poolMatches).toHaveLength(2)
  })

  it('génère 12 poolMatches pour 8 joueurs en 2 poules de 4 (6 matchs par poule)', () => {
    // 2 poules de 4 → C(4,2)=6 matchs chacune → 12 poolMatches
    const result = generatePoolPlusKnockout([1, 2, 3, 4, 5, 6, 7, 8], {
      tournamentId: 1,
      courtCount: 4,
      poolCount: 2,
    })
    expect(result.poolMatches).toHaveLength(12)
  })

  it('knockoutMatches contient des matchs placeholder (teamA et teamB undefined)', () => {
    const result = generatePoolPlusKnockout([1, 2, 3, 4], {
      tournamentId: 1,
      courtCount: 2,
      poolCount: 2,
    })
    expect(result.knockoutMatches.length).toBeGreaterThan(0)
    expect(result.knockoutMatches.every((m) => m.teamA === undefined && m.teamB === undefined)).toBe(true)
  })

  it('knockoutMatches ont des rounds ≥ 101 (préfixe 100+ pour phase knockout)', () => {
    const result = generatePoolPlusKnockout([1, 2, 3, 4], {
      tournamentId: 1,
      courtCount: 2,
      poolCount: 2,
    })
    expect(result.knockoutMatches.every((m) => (m.round ?? 0) >= 101)).toBe(true)
  })

  it('la propriété pools reflète les poules générées', () => {
    const result = generatePoolPlusKnockout([1, 2, 3, 4], {
      tournamentId: 1,
      courtCount: 2,
      poolCount: 2,
    })
    expect(result.pools).toHaveLength(2)
    // Tous les joueurs sont dans les poules
    const allInPools = result.pools.flat().sort((a, b) => a - b)
    expect(allInPools).toEqual([1, 2, 3, 4])
  })

  it('tous les poolMatches ont le tournamentId correct', () => {
    const result = generatePoolPlusKnockout([1, 2, 3, 4], {
      tournamentId: 55,
      courtCount: 2,
      poolCount: 2,
    })
    expect(result.poolMatches.every((m) => m.tournamentId === 55)).toBe(true)
  })

  it('tous les knockoutMatches ont le tournamentId correct', () => {
    const result = generatePoolPlusKnockout([1, 2, 3, 4], {
      tournamentId: 55,
      courtCount: 2,
      poolCount: 2,
    })
    expect(result.knockoutMatches.every((m) => m.tournamentId === 55)).toBe(true)
  })

  it('utilise les poules manuelles si manualPools est fourni', () => {
    const result = generatePoolPlusKnockout([1, 2, 3, 4], {
      tournamentId: 1,
      courtCount: 2,
      poolCount: 2,
      manualPools: [[1, 2], [3, 4]],
    })
    expect(result.pools[0]).toEqual([1, 2])
    expect(result.pools[1]).toEqual([3, 4])
  })

  it('les poolMatches ont le commentaire de groupe (Groupe A, Groupe B…)', () => {
    const result = generatePoolPlusKnockout([1, 2, 3, 4], {
      tournamentId: 1,
      courtCount: 2,
      poolCount: 2,
    })
    const comments = result.poolMatches.map((m) => m.comment)
    expect(comments.some((c) => c === 'Groupe A')).toBe(true)
    expect(comments.some((c) => c === 'Groupe B')).toBe(true)
  })
})
