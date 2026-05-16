/**
 * Tests unitaires — classements (standings)
 * Couvre : computeStandings, computeAmericanoStandings,
 *          computeSwissStandings, computeKingOfCourtStandings
 */

import { describe, it, expect } from 'vitest'
import {
  computeStandings,
  computeAmericanoStandings,
  computeSwissStandings,
  computeKingOfCourtStandings,
} from '@/engine/standings'
import type { ScoringRule, Match, MatchScore } from '@/types/domain'

// ─── Fixtures communes ────────────────────────────────────────────────────────

const regle21: ScoringRule = {
  id: 1,
  name: 'BWF 21pts',
  setsToWin: 2,
  pointsPerSet: 21,
  hasDeuce: true,
  maxScore: 30,
  goldenPoint: false,
  isCustom: false,
}

// ─── computeStandings ─────────────────────────────────────────────────────────

describe('computeStandings', () => {
  it('classe 3 joueurs selon leurs points après 3 matchs (fallback winnerSide)', () => {
    const playerIds = [1, 2, 3]
    const playerNames = new Map([[1, 'Alice'], [2, 'Bob'], [3, 'Charlie']])

    // P1 bat P2, P3 bat P2, P1 bat P3 → P1: 4pts, P3: 3pts, P2: 2pts
    const matches: Match[] = [
      { id: 1, tournamentId: 1, status: 'completed', teamA: '1', teamB: '2', winnerSide: 'A' },
      { id: 2, tournamentId: 1, status: 'completed', teamA: '2', teamB: '3', winnerSide: 'B' },
      { id: 3, tournamentId: 1, status: 'completed', teamA: '1', teamB: '3', winnerSide: 'A' },
    ]
    const scores = new Map<number, MatchScore[]>()

    const standings = computeStandings(playerIds, playerNames, matches, scores, undefined)

    expect(standings).toHaveLength(3)
    expect(standings[0].playerId).toBe(1)
    expect(standings[0].rankPoints).toBe(4)
    expect(standings[1].playerId).toBe(3)
    expect(standings[1].rankPoints).toBe(3)
    expect(standings[2].playerId).toBe(2)
    expect(standings[2].rankPoints).toBe(2)
  })

  it('ignore les matchs en attente (status=pending)', () => {
    const playerIds = [1, 2]
    const playerNames = new Map([[1, 'Alice'], [2, 'Bob']])
    const matches: Match[] = [
      { id: 1, tournamentId: 1, status: 'pending', teamA: '1', teamB: '2' },
    ]
    const scores = new Map<number, MatchScore[]>()

    const standings = computeStandings(playerIds, playerNames, matches, scores, undefined)
    expect(standings[0].rankPoints).toBe(0)
    expect(standings[1].rankPoints).toBe(0)
  })

  it("attribue 0 rankPoints au perdant d'un walkover", () => {
    const playerIds = [1, 2]
    const playerNames = new Map([[1, 'Alice'], [2, 'Bob']])
    const matches: Match[] = [
      { id: 1, tournamentId: 1, status: 'walkover', teamA: '1', teamB: '2', winnerSide: 'A' },
    ]
    const scores = new Map<number, MatchScore[]>()

    const standings = computeStandings(playerIds, playerNames, matches, scores, undefined)
    const alice = standings.find((e) => e.playerId === 1)!
    const bob   = standings.find((e) => e.playerId === 2)!
    expect(alice.rankPoints).toBe(2) // victoire = +2
    expect(bob.rankPoints).toBe(0)   // walkover = +0
  })

  it('utilise les scores réels quand une règle est fournie (setRatio cohérent)', () => {
    const playerIds = [1, 2]
    const playerNames = new Map([[1, 'Alice'], [2, 'Bob']])
    const matches: Match[] = [
      { id: 1, tournamentId: 1, status: 'completed', teamA: '1', teamB: '2', winnerSide: 'A' },
    ]
    const scores = new Map<number, MatchScore[]>([
      [1, [
        { id: 1, matchId: 1, setNumber: 1, scoreA: 21, scoreB: 15 },
        { id: 2, matchId: 1, setNumber: 2, scoreA: 21, scoreB: 18 },
      ]],
    ])

    const standings = computeStandings(playerIds, playerNames, matches, scores, regle21)
    const alice = standings.find((e) => e.playerId === 1)!
    expect(alice.setsWon).toBe(2)
    expect(alice.setsLost).toBe(0)
    expect(alice.setRatio).toBe(2) // setsLost=0 → retourne setsWon
  })

  it('retourne un classement avec nom de fallback si joueur absent de la map', () => {
    const playerIds = [99]
    const playerNames = new Map<number, string>()
    const standings = computeStandings(playerIds, playerNames, [], new Map(), undefined)
    expect(standings[0].playerName).toBe('Joueur 99')
  })
})

// ─── computeAmericanoStandings ────────────────────────────────────────────────

describe('computeAmericanoStandings', () => {
  it('classe 4 joueurs par points cumulés sur 2 matchs en doubles', () => {
    const playerIds = [1, 2, 3, 4]
    const playerNames = new Map([[1, 'Alice'], [2, 'Bob'], [3, 'Charlie'], [4, 'Diane']])

    // Match 1 : [1,2] vs [3,4], A gagne 21-15
    // Match 2 : [1,3] vs [2,4], B gagne 18-21
    const matches: Match[] = [
      { id: 1, tournamentId: 1, status: 'completed', teamA: '1,2', teamB: '3,4', winnerSide: 'A' },
      { id: 2, tournamentId: 1, status: 'completed', teamA: '1,3', teamB: '2,4', winnerSide: 'B' },
    ]
    const scores = new Map<number, MatchScore[]>([
      [1, [{ id: 1, matchId: 1, setNumber: 1, scoreA: 21, scoreB: 15 }]],
      [2, [{ id: 2, matchId: 2, setNumber: 1, scoreA: 18, scoreB: 21 }]],
    ])

    const standings = computeAmericanoStandings(playerIds, playerNames, matches, scores)

    // P2: 21+21=42, P1: 21+18=39, P4: 15+21=36, P3: 15+18=33
    expect(standings[0].playerId).toBe(2)
    expect(standings[0].totalPoints).toBe(42)
    expect(standings[1].playerId).toBe(1)
    expect(standings[1].totalPoints).toBe(39)
    expect(standings[2].playerId).toBe(4)
    expect(standings[2].totalPoints).toBe(36)
    expect(standings[3].playerId).toBe(3)
    expect(standings[3].totalPoints).toBe(33)
  })

  it('compte les victoires et défaites correctement', () => {
    const playerIds = [1, 2]
    const playerNames = new Map([[1, 'Alice'], [2, 'Bob']])
    const matches: Match[] = [
      { id: 1, tournamentId: 1, status: 'completed', teamA: '1', teamB: '2', winnerSide: 'A' },
      { id: 2, tournamentId: 1, status: 'completed', teamA: '1', teamB: '2', winnerSide: 'B' },
    ]
    const scores = new Map<number, MatchScore[]>([
      [1, [{ id: 1, matchId: 1, setNumber: 1, scoreA: 21, scoreB: 15 }]],
      [2, [{ id: 2, matchId: 2, setNumber: 1, scoreA: 18, scoreB: 21 }]],
    ])

    const standings = computeAmericanoStandings(playerIds, playerNames, matches, scores)
    const alice = standings.find((e) => e.playerId === 1)!
    expect(alice.wins).toBe(1)
    expect(alice.losses).toBe(1)
    expect(alice.matchesPlayed).toBe(2)
  })

  it('ignore les matchs en attente', () => {
    const playerIds = [1, 2]
    const playerNames = new Map([[1, 'Alice'], [2, 'Bob']])
    const matches: Match[] = [
      { id: 1, tournamentId: 1, status: 'pending', teamA: '1', teamB: '2' },
    ]
    const standings = computeAmericanoStandings(playerIds, playerNames, matches, new Map())
    expect(standings[0].totalPoints).toBe(0)
    expect(standings[1].totalPoints).toBe(0)
  })
})

// ─── computeSwissStandings ────────────────────────────────────────────────────

describe('computeSwissStandings', () => {
  it('classe 4 joueurs avec points suisses et buchholz après 2 rondes', () => {
    const playerIds = [1, 2, 3, 4]
    const playerNames = new Map([[1, 'Alice'], [2, 'Bob'], [3, 'Charlie'], [4, 'Diane']])

    // Ronde 1 : P1 bat P3 (2pts), P2 bat P4 (2pts), P3/P4 reçoivent 1pt
    // Ronde 2 : P2 bat P1 (P2→4pts, P1→3pts), P3 bat P4 (P3→3pts, P4→2pts)
    const matches: Match[] = [
      { id: 1, tournamentId: 1, round: 1, status: 'completed', teamA: '1', teamB: '3', winnerSide: 'A' },
      { id: 2, tournamentId: 1, round: 1, status: 'completed', teamA: '2', teamB: '4', winnerSide: 'A' },
      { id: 3, tournamentId: 1, round: 2, status: 'completed', teamA: '2', teamB: '1', winnerSide: 'A' },
      { id: 4, tournamentId: 1, round: 2, status: 'completed', teamA: '3', teamB: '4', winnerSide: 'A' },
    ]
    const scores = new Map<number, MatchScore[]>()

    const standings = computeSwissStandings(playerIds, playerNames, matches, scores)

    // Classement : P2(4pts), P1(3pts, buchholz=7), P3(3pts, buchholz=5), P4(2pts)
    expect(standings[0].playerId).toBe(2)
    expect(standings[0].swissPoints).toBe(4)
    expect(standings[1].playerId).toBe(1)
    expect(standings[1].swissPoints).toBe(3)
    expect(standings[1].buchholz).toBe(7) // adversaires P3(3) + P2(4)
    expect(standings[2].playerId).toBe(3)
    expect(standings[2].swissPoints).toBe(3)
    expect(standings[2].buchholz).toBe(5) // adversaires P1(3) + P4(2)
    expect(standings[3].playerId).toBe(4)
    expect(standings[3].swissPoints).toBe(2)
  })

  it("attribue 0 pts au perdant d'un walkover", () => {
    const playerIds = [1, 2]
    const playerNames = new Map([[1, 'Alice'], [2, 'Bob']])
    const matches: Match[] = [
      { id: 1, tournamentId: 1, round: 1, status: 'walkover', teamA: '1', teamB: '2', winnerSide: 'A' },
    ]
    const standings = computeSwissStandings(playerIds, playerNames, matches, new Map())
    const alice = standings.find((e) => e.playerId === 1)!
    const bob   = standings.find((e) => e.playerId === 2)!
    expect(alice.swissPoints).toBe(2)
    expect(bob.swissPoints).toBe(0)
  })

  it('gère un bye explicite (teamB=BYE)', () => {
    const playerIds = [1, 2, 3]
    const playerNames = new Map([[1, 'Alice'], [2, 'Bob'], [3, 'Charlie']])

    // P3 obtient un bye (absent de la ronde)
    const matches: Match[] = [
      { id: 1, tournamentId: 1, round: 1, status: 'completed', teamA: '1', teamB: '2', winnerSide: 'A' },
    ]
    const standings = computeSwissStandings(playerIds, playerNames, matches, new Map())
    const charlie = standings.find((e) => e.playerId === 3)!
    // P3 est absent de la ronde → bye silencieux → +2 pts
    expect(charlie.swissPoints).toBe(2)
  })
})

// ─── computeKingOfCourtStandings ──────────────────────────────────────────────

describe('computeKingOfCourtStandings', () => {
  it('classe par winsOnCourt1 en priorité', () => {
    const playerIds = [1, 2, 3, 4]
    const playerNames = new Map([[1, 'Alice'], [2, 'Bob'], [3, 'Charlie'], [4, 'Diane']])

    // Court 1 (trône) : P1 gagne → P1 a 1 winsOnCourt1
    // Court 2 : P3 gagne → P3 a 0 winsOnCourt1 mais 1 totalWins
    const matches: Match[] = [
      { id: 1, tournamentId: 1, courtNumber: 1, status: 'completed', teamA: '1', teamB: '2', winnerSide: 'A' },
      { id: 2, tournamentId: 1, courtNumber: 2, status: 'completed', teamA: '3', teamB: '4', winnerSide: 'A' },
    ]

    const standings = computeKingOfCourtStandings(playerIds, playerNames, matches, new Map())

    expect(standings[0].playerId).toBe(1)
    expect(standings[0].winsOnCourt1).toBe(1)
    expect(standings[1].playerId).toBe(3)
    expect(standings[1].winsOnCourt1).toBe(0)
    expect(standings[1].totalWins).toBe(1)
  })

  it('classe par totalWins si winsOnCourt1 sont égaux', () => {
    const playerIds = [1, 2, 3, 4]
    const playerNames = new Map([[1, 'Alice'], [2, 'Bob'], [3, 'Charlie'], [4, 'Diane']])

    // Aucune victoire sur court 1 — départage par totalWins
    const matches: Match[] = [
      { id: 1, tournamentId: 1, courtNumber: 2, status: 'completed', teamA: '1', teamB: '2', winnerSide: 'A' },
      { id: 2, tournamentId: 1, courtNumber: 2, status: 'completed', teamA: '3', teamB: '4', winnerSide: 'B' },
      { id: 3, tournamentId: 1, courtNumber: 2, status: 'completed', teamA: '1', teamB: '3', winnerSide: 'A' },
    ]

    const standings = computeKingOfCourtStandings(playerIds, playerNames, matches, new Map())
    // P1: 2 totalWins, P4: 1 totalWin, P3: 1 totalWin, P2: 0
    expect(standings[0].playerId).toBe(1)
    expect(standings[0].totalWins).toBe(2)
  })

  it("trie par nom alphabétique en cas d'égalité totale", () => {
    const playerIds = [1, 2]
    const playerNames = new Map([[1, 'Zara'], [2, 'Alice']])
    const standings = computeKingOfCourtStandings(playerIds, playerNames, [], new Map())
    // Même score (0 partout) → ordre alphabétique
    expect(standings[0].playerName).toBe('Alice')
    expect(standings[1].playerName).toBe('Zara')
  })

  it('compte matchesPlayed correctement', () => {
    const playerIds = [1, 2]
    const playerNames = new Map([[1, 'Alice'], [2, 'Bob']])
    const matches: Match[] = [
      { id: 1, tournamentId: 1, courtNumber: 1, status: 'completed', teamA: '1', teamB: '2', winnerSide: 'A' },
      { id: 2, tournamentId: 1, courtNumber: 1, status: 'completed', teamA: '1', teamB: '2', winnerSide: 'B' },
    ]

    const standings = computeKingOfCourtStandings(playerIds, playerNames, matches, new Map())
    const alice = standings.find((e) => e.playerId === 1)!
    expect(alice.matchesPlayed).toBe(2)
    expect(alice.winsOnCourt1).toBe(1)
  })
})
