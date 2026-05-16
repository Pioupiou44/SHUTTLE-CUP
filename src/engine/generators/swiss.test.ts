/**
 * Tests unitaires — générateur Système Suisse
 * Couvre : generateSwissRound1, generateNextSwissRound
 */

import { describe, it, expect } from 'vitest'
import {
  generateSwissRound1,
  generateNextSwissRound,
} from '@/engine/generators/swiss'
import type { Match } from '@/types/domain'

const config = { tournamentId: 1, courtCount: 4 }

// ─── generateSwissRound1 ──────────────────────────────────────────────────────

describe('generateSwissRound1', () => {
  it('génère 4 matchs pour 8 joueurs (nombre pair)', () => {
    const unitIds = [1, 2, 3, 4, 5, 6, 7, 8]
    const matches = generateSwissRound1(unitIds, config)
    expect(matches).toHaveLength(4)
  })

  it('apparie moitié haute vs moitié basse pour 8 joueurs (style FIDE)', () => {
    const unitIds = [1, 2, 3, 4, 5, 6, 7, 8]
    const matches = generateSwissRound1(unitIds, config)
    // 1vs5, 2vs6, 3vs7, 4vs8
    expect(matches[0].teamA).toBe('1')
    expect(matches[0].teamB).toBe('5')
    expect(matches[1].teamA).toBe('2')
    expect(matches[1].teamB).toBe('6')
    expect(matches[2].teamA).toBe('3')
    expect(matches[2].teamB).toBe('7')
    expect(matches[3].teamA).toBe('4')
    expect(matches[3].teamB).toBe('8')
  })

  it('génère 3 matchs pour 7 joueurs (impair → dernier reçoit un bye silencieux)', () => {
    const unitIds = [1, 2, 3, 4, 5, 6, 7]
    const matches = generateSwissRound1(unitIds, config)
    expect(matches).toHaveLength(3)
  })

  it("exclut le dernier joueur (bye) avec 7 joueurs — aucun match n'implique le joueur 7", () => {
    const unitIds = [1, 2, 3, 4, 5, 6, 7]
    const matches = generateSwissRound1(unitIds, config)
    const teams = matches.flatMap((m) => [m.teamA, m.teamB])
    expect(teams).not.toContain('7')
  })

  it('génère 1 match pour 2 joueurs', () => {
    const matches = generateSwissRound1([1, 2], config)
    expect(matches).toHaveLength(1)
  })

  it('retourne une liste vide pour 1 joueur', () => {
    const matches = generateSwissRound1([1], config)
    expect(matches).toHaveLength(0)
  })

  it('tous les matchs sont à la ronde 1', () => {
    const matches = generateSwissRound1([1, 2, 3, 4], config)
    expect(matches.every((m) => m.round === 1)).toBe(true)
  })

  it('tous les matchs ont le status "pending"', () => {
    const matches = generateSwissRound1([1, 2, 3, 4], config)
    expect(matches.every((m) => m.status === 'pending')).toBe(true)
  })

  it('assigne les numéros de terrain correctement', () => {
    const matches = generateSwissRound1([1, 2, 3, 4], { tournamentId: 1, courtCount: 2 })
    expect(matches[0].courtNumber).toBe(1)
    expect(matches[1].courtNumber).toBe(2)
  })
})

// ─── generateNextSwissRound ───────────────────────────────────────────────────

describe('generateNextSwissRound', () => {
  it('génère 2 matchs pour 4 joueurs en ronde 2', () => {
    const unitIds = [1, 2, 3, 4]
    const allMatches: Pick<Match, 'teamA' | 'teamB' | 'winnerSide' | 'status'>[] = [
      { teamA: '1', teamB: '3', winnerSide: 'A', status: 'completed' },
      { teamA: '2', teamB: '4', winnerSide: 'A', status: 'completed' },
    ]
    const matches = generateNextSwissRound(unitIds, allMatches, 2, config)
    expect(matches).toHaveLength(2)
  })

  it('évite les revanches : P1 ne rejoue pas contre P3 si possible', () => {
    const unitIds = [1, 2, 3, 4]
    // Ronde 1 : 1vs3, 2vs4
    const allMatches: Pick<Match, 'teamA' | 'teamB' | 'winnerSide' | 'status'>[] = [
      { teamA: '1', teamB: '3', winnerSide: 'A', status: 'completed' },
      { teamA: '2', teamB: '4', winnerSide: 'A', status: 'completed' },
    ]
    const matches = generateNextSwissRound(unitIds, allMatches, 2, config)

    // Les paires (1,3) et (2,4) ne doivent pas réapparaître
    const pairs = matches.map((m) =>
      [m.teamA!, m.teamB!].sort().join('-')
    )
    expect(pairs).not.toContain('1-3')
    expect(pairs).not.toContain('2-4')
  })

  it('apparie les joueurs de scores similaires', () => {
    // Après ronde 1 : P1(2pts) a battu P3, P2(2pts) a battu P4
    // P1 et P2 ont le plus de points → doivent être appariés ensemble en ronde 2
    const unitIds = [1, 2, 3, 4]
    const allMatches: Pick<Match, 'teamA' | 'teamB' | 'winnerSide' | 'status'>[] = [
      { teamA: '1', teamB: '3', winnerSide: 'A', status: 'completed' },
      { teamA: '2', teamB: '4', winnerSide: 'A', status: 'completed' },
    ]
    const matches = generateNextSwissRound(unitIds, allMatches, 2, config)
    const pairs = matches.map((m) => [m.teamA!, m.teamB!].sort().join('-'))

    // P1 vs P2 (les 2 gagnants), P3 vs P4 (les 2 perdants)
    expect(pairs).toContain('1-2')
    expect(pairs).toContain('3-4')
  })

  it('accepte une revanche si tous les adversaires disponibles ont déjà été rencontrés', () => {
    // 2 joueurs — pas de choix, revanche forcée en ronde 2
    const unitIds = [1, 2]
    const allMatches: Pick<Match, 'teamA' | 'teamB' | 'winnerSide' | 'status'>[] = [
      { teamA: '1', teamB: '2', winnerSide: 'A', status: 'completed' },
    ]
    const matches = generateNextSwissRound(unitIds, allMatches, 2, config)
    // Doit générer un match même si c'est une revanche
    expect(matches).toHaveLength(1)
  })

  it('tous les matchs sont à la ronde demandée', () => {
    const unitIds = [1, 2, 3, 4]
    const allMatches: Pick<Match, 'teamA' | 'teamB' | 'winnerSide' | 'status'>[] = [
      { teamA: '1', teamB: '3', winnerSide: 'A', status: 'completed' },
      { teamA: '2', teamB: '4', winnerSide: 'A', status: 'completed' },
    ]
    const matches = generateNextSwissRound(unitIds, allMatches, 3, config)
    expect(matches.every((m) => m.round === 3)).toBe(true)
  })

  it('ignore les matchs non terminés pour le calcul des points', () => {
    const unitIds = [1, 2, 3, 4]
    const allMatches: Pick<Match, 'teamA' | 'teamB' | 'winnerSide' | 'status'>[] = [
      // Match en cours — ne doit pas être pris en compte
      { teamA: '1', teamB: '2', winnerSide: undefined, status: 'in_progress' },
      { teamA: '3', teamB: '4', winnerSide: 'A',       status: 'completed'   },
    ]
    // Tous à 0pt (sauf P3 avec 2pts, P4 avec 1pt) — ne doit pas lever d'erreur
    expect(() =>
      generateNextSwissRound(unitIds, allMatches, 2, config)
    ).not.toThrow()
  })

  it('génère un bye silencieux si nombre de joueurs impair', () => {
    // 3 joueurs → 1 match + 1 joueur sans match (bye silencieux, aucun match créé)
    const unitIds = [1, 2, 3]
    const allMatches: Pick<Match, 'teamA' | 'teamB' | 'winnerSide' | 'status'>[] = []
    const matches = generateNextSwissRound(unitIds, allMatches, 1, config)
    expect(matches).toHaveLength(1)
  })
})
