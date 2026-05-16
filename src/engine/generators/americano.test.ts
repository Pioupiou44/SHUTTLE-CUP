/**
 * Tests unitaires — générateur Américano
 * Couvre : generateAmericano, countAmericanoRounds
 */

import { describe, it, expect } from 'vitest'
import { generateAmericano, countAmericanoRounds } from '@/engine/generators/americano'

// ─── countAmericanoRounds ─────────────────────────────────────────────────────

describe('countAmericanoRounds', () => {
  it('retourne 3 pour 3 joueurs (minimum garanti)', () => {
    expect(countAmericanoRounds(3)).toBe(3)
  })

  it('retourne 3 pour 4 joueurs (max(3, 4-1) = 3)', () => {
    expect(countAmericanoRounds(4)).toBe(3)
  })

  it('retourne 7 pour 8 joueurs (max(3, 8-1) = 7)', () => {
    expect(countAmericanoRounds(8)).toBe(7)
  })

  it('retourne 11 pour 12 joueurs (max(3, 12-1) = 11)', () => {
    expect(countAmericanoRounds(12)).toBe(11)
  })
})

// ─── generateAmericano ────────────────────────────────────────────────────────

describe('generateAmericano', () => {
  it('retourne [] avec moins de 4 joueurs (1 joueur)', () => {
    const matches = generateAmericano([1], { tournamentId: 1, courtCount: 1 })
    expect(matches).toHaveLength(0)
  })

  it('retourne [] avec moins de 4 joueurs (3 joueurs)', () => {
    const matches = generateAmericano([1, 2, 3], { tournamentId: 1, courtCount: 2 })
    expect(matches).toHaveLength(0)
  })

  it('retourne [] avec 0 joueur', () => {
    const matches = generateAmericano([], { tournamentId: 1, courtCount: 2 })
    expect(matches).toHaveLength(0)
  })

  it('génère des matchs avec 4 joueurs', () => {
    const matches = generateAmericano([1, 2, 3, 4], { tournamentId: 1, courtCount: 1 })
    expect(matches.length).toBeGreaterThan(0)
  })

  it('chaque match a des équipes de 2 joueurs (format "id1,id2") avec 4 joueurs', () => {
    const matches = generateAmericano([1, 2, 3, 4], { tournamentId: 1, courtCount: 1 })
    for (const m of matches) {
      expect(m.teamA).toMatch(/^\d+,\d+$/)
      expect(m.teamB).toMatch(/^\d+,\d+$/)
    }
  })

  it('les équipes d\'un match contiennent exactement 4 joueurs distincts avec 4 joueurs', () => {
    const matches = generateAmericano([1, 2, 3, 4], { tournamentId: 1, courtCount: 1 })
    for (const m of matches) {
      const a = m.teamA!.split(',').map(Number)
      const b = m.teamB!.split(',').map(Number)
      const all = [...a, ...b]
      // 4 joueurs distincts dans le match
      expect(new Set(all).size).toBe(4)
    }
  })

  it('génère des matchs cohérents avec 8 joueurs', () => {
    const matches = generateAmericano([1, 2, 3, 4, 5, 6, 7, 8], { tournamentId: 1, courtCount: 2 })
    expect(matches.length).toBeGreaterThan(0)
    // Chaque ronde de 8 joueurs = 2 matchs de 4 (8 actifs sur 2 terrains)
    // Vérifier que chaque match a bien 2 équipes de 2
    for (const m of matches) {
      const a = m.teamA!.split(',').map(Number)
      const b = m.teamB!.split(',').map(Number)
      expect(a).toHaveLength(2)
      expect(b).toHaveLength(2)
    }
  })

  it('tous les matchs ont le tournamentId correct', () => {
    const matches = generateAmericano([1, 2, 3, 4], { tournamentId: 42, courtCount: 1 })
    expect(matches.every((m) => m.tournamentId === 42)).toBe(true)
  })

  it('tous les matchs ont le status "pending"', () => {
    const matches = generateAmericano([1, 2, 3, 4], { tournamentId: 1, courtCount: 1 })
    expect(matches.every((m) => m.status === 'pending')).toBe(true)
  })

  it('respecte le nombre de rondes personnalisé via config.rounds', () => {
    // 4 joueurs, 1 terrain, 2 rondes imposées → 2 matchs
    const matches = generateAmericano([1, 2, 3, 4], { tournamentId: 1, courtCount: 1, rounds: 2 })
    expect(matches).toHaveLength(2)
  })

  it('respecte le nombre de rondes par défaut pour 4 joueurs (max(3, 3) = 3 rondes)', () => {
    // 4 joueurs, 1 terrain → 3 rondes × 1 match = 3 matchs
    const matches = generateAmericano([1, 2, 3, 4], { tournamentId: 1, courtCount: 1 })
    expect(matches).toHaveLength(3)
  })

  it('les numéros de terrain respectent courtCount', () => {
    const matches = generateAmericano([1, 2, 3, 4, 5, 6, 7, 8], { tournamentId: 1, courtCount: 2 })
    const withCourt = matches.filter((m) => m.courtNumber !== undefined)
    expect(withCourt.every((m) => (m.courtNumber ?? 0) <= 2)).toBe(true)
  })

  it('les numéros de ronde sont croissants et continus', () => {
    const matches = generateAmericano([1, 2, 3, 4], { tournamentId: 1, courtCount: 1 })
    const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => (a ?? 0) - (b ?? 0))
    expect(rounds[0]).toBe(1)
    expect(rounds[rounds.length - 1]).toBe(rounds.length)
  })
})
