/**
 * Tests unitaires — générateur King of Court
 * Couvre : generateKingOfCourtRound1, generateNextKingOfCourtRound
 */

import { describe, it, expect } from 'vitest'
import {
  generateKingOfCourtRound1,
  generateNextKingOfCourtRound,
} from '@/engine/generators/kingOfCourt'

// ─── generateKingOfCourtRound1 ────────────────────────────────────────────────

describe('generateKingOfCourtRound1', () => {
  it('génère 3 matchs pour 6 joueurs sur 3 terrains', () => {
    const matches = generateKingOfCourtRound1([1, 2, 3, 4, 5, 6], { tournamentId: 1, courtCount: 3 })
    expect(matches).toHaveLength(3)
  })

  it('génère 2 matchs pour 5 joueurs sur 3 terrains (Math.floor(5/2) = 2 terrains actifs)', () => {
    const matches = generateKingOfCourtRound1([1, 2, 3, 4, 5], { tournamentId: 1, courtCount: 3 })
    expect(matches).toHaveLength(2)
  })

  it('génère 1 match pour 4 joueurs sur 1 terrain', () => {
    const matches = generateKingOfCourtRound1([1, 2, 3, 4], { tournamentId: 1, courtCount: 1 })
    expect(matches).toHaveLength(1)
  })

  it('retourne [] si moins de 2 unités', () => {
    const matches = generateKingOfCourtRound1([1], { tournamentId: 1, courtCount: 2 })
    expect(matches).toHaveLength(0)
  })

  it('les numéros de terrain sont 1, 2, 3 (consécutifs)', () => {
    const matches = generateKingOfCourtRound1([1, 2, 3, 4, 5, 6], { tournamentId: 1, courtCount: 3 })
    const courts = matches.map((m) => m.courtNumber)
    expect(courts).toEqual([1, 2, 3])
  })

  it('la première unité est teamA du terrain 1, la deuxième est teamB', () => {
    const matches = generateKingOfCourtRound1([10, 20, 30, 40], { tournamentId: 1, courtCount: 2 })
    expect(matches[0].teamA).toBe('10')
    expect(matches[0].teamB).toBe('20')
    expect(matches[1].teamA).toBe('30')
    expect(matches[1].teamB).toBe('40')
  })

  it('tous les matchs ont le tournamentId correct', () => {
    const matches = generateKingOfCourtRound1([1, 2, 3, 4], { tournamentId: 99, courtCount: 2 })
    expect(matches.every((m) => m.tournamentId === 99)).toBe(true)
  })

  it('tous les matchs ont le status "pending"', () => {
    const matches = generateKingOfCourtRound1([1, 2, 3, 4], { tournamentId: 1, courtCount: 2 })
    expect(matches.every((m) => m.status === 'pending')).toBe(true)
  })

  it('tous les matchs sont en ronde 1', () => {
    const matches = generateKingOfCourtRound1([1, 2, 3, 4], { tournamentId: 1, courtCount: 2 })
    expect(matches.every((m) => m.round === 1)).toBe(true)
  })

  it('limite les terrains actifs au courtCount si moins de joueurs que terrains', () => {
    // 4 joueurs → 2 terrains actifs max, courtCount=5 → 2 matchs
    const matches = generateKingOfCourtRound1([1, 2, 3, 4], { tournamentId: 1, courtCount: 5 })
    expect(matches).toHaveLength(2)
  })
})

// ─── generateNextKingOfCourtRound ─────────────────────────────────────────────

describe('generateNextKingOfCourtRound', () => {
  /**
   * Scénario : 2 terrains.
   * Court 1 : teamA="1" vs teamB="2", vainqueur = A (winnerSide = 'A')
   * Court 2 : teamA="3" vs teamB="4", vainqueur = B (winnerSide = 'B')
   *
   * ranked après tri :
   *   gagnants : [court1.teamA="1", court2.teamB="4"]
   *   perdants  : [court1.teamB="2", court2.teamA="3"]
   * Court 1 suivant : ranked[0]="1" vs ranked[1]="4"
   * Court 2 suivant : ranked[2]="2" vs ranked[3]="3"
   */
  const previousMatches = [
    { courtNumber: 1, winnerSide: 'A' as const, teamA: '1', teamB: '2' },
    { courtNumber: 2, winnerSide: 'B' as const, teamA: '3', teamB: '4' },
  ]

  it('génère le même nombre de matchs que le tour précédent', () => {
    const matches = generateNextKingOfCourtRound(previousMatches, [], 2, { tournamentId: 1, courtCount: 2 })
    expect(matches).toHaveLength(2)
  })

  it('le vainqueur du terrain 1 est placé sur le terrain 1 de la ronde suivante', () => {
    const matches = generateNextKingOfCourtRound(previousMatches, [], 2, { tournamentId: 1, courtCount: 2 })
    const court1 = matches.find((m) => m.courtNumber === 1)!
    // ranked[0] = vainqueur court1 = "1" → teamA du terrain 1
    expect(court1.teamA).toBe('1')
  })

  it('le perdant du terrain 1 descend au terrain 2 de la ronde suivante', () => {
    const matches = generateNextKingOfCourtRound(previousMatches, [], 2, { tournamentId: 1, courtCount: 2 })
    const court2 = matches.find((m) => m.courtNumber === 2)!
    // ranked[2] = perdant court1 = "2" → teamA du terrain 2
    expect(court2.teamA).toBe('2')
  })

  it('utilise le bon numéro de ronde', () => {
    const matches = generateNextKingOfCourtRound(previousMatches, [], 5, { tournamentId: 1, courtCount: 2 })
    expect(matches.every((m) => m.round === 5)).toBe(true)
  })

  it('les unités en file d\'attente sont placées en dernier dans le classement', () => {
    // Avec 1 terrain et 3 unités : "1" vs "2" (court 1), "3" en attente
    const prev = [{ courtNumber: 1, winnerSide: 'A' as const, teamA: '1', teamB: '2' }]
    const matches = generateNextKingOfCourtRound(prev, ['3'], 2, { tournamentId: 1, courtCount: 1 })
    // ranked = ["1", "2", "3"] → court 1 : ranked[0]="1" vs ranked[1]="2"
    expect(matches[0].teamA).toBe('1')
    expect(matches[0].teamB).toBe('2')
  })

  it('retourne [] si aucun match précédent', () => {
    const matches = generateNextKingOfCourtRound([], [], 2, { tournamentId: 1, courtCount: 2 })
    expect(matches).toHaveLength(0)
  })

  it('tous les matchs ont le tournamentId correct', () => {
    const matches = generateNextKingOfCourtRound(previousMatches, [], 2, { tournamentId: 7, courtCount: 2 })
    expect(matches.every((m) => m.tournamentId === 7)).toBe(true)
  })

  it('tous les matchs ont le status "pending"', () => {
    const matches = generateNextKingOfCourtRound(previousMatches, [], 2, { tournamentId: 1, courtCount: 2 })
    expect(matches.every((m) => m.status === 'pending')).toBe(true)
  })

  it('tri correct même si les matchs précédents ne sont pas ordonnés par terrain', () => {
    // Inversion de l'ordre pour vérifier le tri
    const unordered = [
      { courtNumber: 2, winnerSide: 'B' as const, teamA: '3', teamB: '4' },
      { courtNumber: 1, winnerSide: 'A' as const, teamA: '1', teamB: '2' },
    ]
    const matches = generateNextKingOfCourtRound(unordered, [], 2, { tournamentId: 1, courtCount: 2 })
    const court1 = matches.find((m) => m.courtNumber === 1)!
    // Même résultat qu'avec les matchs ordonnés
    expect(court1.teamA).toBe('1')
  })
})
