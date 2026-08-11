/**
 * Tests unitaires — générateur Round Robin
 * Couvre : generateRoundRobin, countRoundRobinMatches, estimateDuration
 */

import { describe, it, expect } from 'vitest'
import {
  generateRoundRobin,
  countRoundRobinMatches,
  estimateDuration,
} from '@/engine/generators/roundRobin'

// ─── generateRoundRobin ───────────────────────────────────────────────────────

describe('generateRoundRobin', () => {
  it('génère 6 matchs pour 4 joueurs', () => {
    const matches = generateRoundRobin([1, 2, 3, 4], { tournamentId: 1, courtCount: 2 })
    expect(matches).toHaveLength(6)
  })

  it('chaque paire joue exactement une fois avec 4 joueurs', () => {
    const matches = generateRoundRobin([1, 2, 3, 4], { tournamentId: 1, courtCount: 2 })
    const pairs = matches.map((m) =>
      [parseInt(m.teamA!), parseInt(m.teamB!)].sort((a, b) => a - b).join('-')
    )
    // Toutes les paires sont uniques
    expect(new Set(pairs).size).toBe(6)
  })

  it('génère 3 matchs pour 3 joueurs (nombre impair → bye silencieux)', () => {
    const matches = generateRoundRobin([1, 2, 3], { tournamentId: 1, courtCount: 2 })
    expect(matches).toHaveLength(3)
  })

  it('chaque paire joue exactement une fois avec 3 joueurs', () => {
    const matches = generateRoundRobin([1, 2, 3], { tournamentId: 1, courtCount: 2 })
    const pairs = matches.map((m) =>
      [parseInt(m.teamA!), parseInt(m.teamB!)].sort((a, b) => a - b).join('-')
    )
    expect(new Set(pairs).size).toBe(3)
  })

  it('génère 10 matchs pour 5 joueurs', () => {
    const matches = generateRoundRobin([1, 2, 3, 4, 5], { tournamentId: 1, courtCount: 2 })
    expect(matches).toHaveLength(10)
  })

  it('génère 15 matchs pour 6 joueurs', () => {
    const matches = generateRoundRobin([1, 2, 3, 4, 5, 6], { tournamentId: 1, courtCount: 3 })
    expect(matches).toHaveLength(15)
  })

  it('chaque paire joue exactement une fois avec 6 joueurs', () => {
    const matches = generateRoundRobin([1, 2, 3, 4, 5, 6], { tournamentId: 1, courtCount: 3 })
    const pairs = matches.map((m) =>
      [parseInt(m.teamA!), parseInt(m.teamB!)].sort((a, b) => a - b).join('-')
    )
    expect(new Set(pairs).size).toBe(15)
  })

  it('tous les matchs ont le tournamentId correct', () => {
    const matches = generateRoundRobin([1, 2, 3, 4], { tournamentId: 42, courtCount: 2 })
    expect(matches.every((m) => m.tournamentId === 42)).toBe(true)
  })

  it('tous les matchs ont le status "pending"', () => {
    const matches = generateRoundRobin([1, 2, 3, 4], { tournamentId: 1, courtCount: 2 })
    expect(matches.every((m) => m.status === 'pending')).toBe(true)
  })

  it('assigne les numéros de terrain correctement', () => {
    const matches = generateRoundRobin([1, 2, 3, 4], { tournamentId: 1, courtCount: 2 })
    // Les matchs avec courtNumber doivent être ≤ courtCount
    const withCourt = matches.filter((m) => m.courtNumber !== undefined)
    expect(withCourt.every((m) => (m.courtNumber ?? 0) <= 2)).toBe(true)
  })

  it('retourne une liste vide pour 0 joueurs', () => {
    const matches = generateRoundRobin([], { tournamentId: 1, courtCount: 2 })
    expect(matches).toHaveLength(0)
  })

  it("retourne une liste vide pour 1 joueur (pas d'adversaire réel)", () => {
    // 1 joueur impair → bye ajouté, mais la paire (joueur, bye) est ignorée
    const matches = generateRoundRobin([1], { tournamentId: 1, courtCount: 2 })
    expect(matches).toHaveLength(0)
  })

  it('génère 1 match pour 2 joueurs', () => {
    const matches = generateRoundRobin([1, 2], { tournamentId: 1, courtCount: 1 })
    expect(matches).toHaveLength(1)
  })

  it('assigne les rondes correctement (round commence à 1)', () => {
    const matches = generateRoundRobin([1, 2, 3, 4], { tournamentId: 1, courtCount: 2 })
    const rounds = matches.map((m) => m.round)
    expect(Math.min(...(rounds.filter((r): r is number => r !== undefined)))).toBe(1)
  })
})

// ─── countRoundRobinMatches ───────────────────────────────────────────────────

describe('countRoundRobinMatches', () => {
  it('retourne 1 pour 2 joueurs', () => {
    expect(countRoundRobinMatches(2)).toBe(1)
  })

  it('retourne 3 pour 3 joueurs', () => {
    expect(countRoundRobinMatches(3)).toBe(3)
  })

  it('retourne 6 pour 4 joueurs', () => {
    expect(countRoundRobinMatches(4)).toBe(6)
  })

  it('retourne 10 pour 5 joueurs', () => {
    expect(countRoundRobinMatches(5)).toBe(10)
  })

  it('retourne 15 pour 6 joueurs', () => {
    expect(countRoundRobinMatches(6)).toBe(15)
  })

  it('retourne 28 pour 8 joueurs', () => {
    expect(countRoundRobinMatches(8)).toBe(28)
  })

  it('retourne 0 pour 0 joueur', () => {
    expect(countRoundRobinMatches(0)).toBeCloseTo(0)
  })

  it('retourne 0 pour 1 joueur', () => {
    expect(countRoundRobinMatches(1)).toBe(0)
  })
})

// ─── estimateDuration ────────────────────────────────────────────────────────

describe('estimateDuration', () => {
  it('retourne 60 min pour 4 joueurs, 2 terrains, 20 min/match', () => {
    // 6 matchs, ceil(6/2)=3 rondes, 3×20=60
    expect(estimateDuration(4, 2, 20)).toBe(60)
  })

  it('retourne 120 min pour 4 joueurs, 1 terrain, 20 min/match', () => {
    // 6 matchs, ceil(6/1)=6 rondes, 6×20=120
    expect(estimateDuration(4, 1, 20)).toBe(120)
  })

  it('utilise 20 min par match par défaut', () => {
    const avecDefault = estimateDuration(4, 2)
    const avecExplicite = estimateDuration(4, 2, 20)
    expect(avecDefault).toBe(avecExplicite)
  })

  it('la durée diminue quand on ajoute des terrains', () => {
    const moins = estimateDuration(8, 2, 20)
    const plus  = estimateDuration(8, 4, 20)
    expect(plus).toBeLessThanOrEqual(moins)
  })

  it('ne divise pas par zéro si courtCount=0 (clamp à 1)', () => {
    // Math.max(1, 0) = 1 → pas de division par zéro
    expect(() => estimateDuration(4, 0, 20)).not.toThrow()
  })
})
