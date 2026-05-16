/**
 * Tests unitaires — moteur de scoring
 * Couvre : isSetComplete, getSetWinner, computeMatchResult, getCurrentSet, formatMatchScore
 */

import { describe, it, expect } from 'vitest'
import {
  isSetComplete,
  getSetWinner,
  computeMatchResult,
  getCurrentSet,
  formatMatchScore,
} from '@/engine/scoring'
import type { MatchResult } from '@/engine/scoring'
import type { ScoringRule, MatchScore } from '@/types/domain'

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** Règle BWF 21 points avec déuce et golden point à 30 */
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

/** Règle 11 points sans déuce (format rapide) */
const regle11SansDeuce: ScoringRule = {
  id: 2,
  name: '11pts sans déuce',
  setsToWin: 1,
  pointsPerSet: 11,
  hasDeuce: false,
  maxScore: 0,
  goldenPoint: false,
  isCustom: true,
}

/** Règle 15 points avec déuce */
const regle15: ScoringRule = {
  id: 3,
  name: 'BWF 15pts',
  setsToWin: 2,
  pointsPerSet: 15,
  hasDeuce: true,
  maxScore: 17,
  goldenPoint: false,
  isCustom: false,
}

// ─── isSetComplete ────────────────────────────────────────────────────────────

describe('isSetComplete', () => {
  it('retourne false pour un set en cours (20-18 avec déuce)', () => {
    expect(isSetComplete(20, 18, regle21)).toBe(false)
  })

  it('retourne false pour 20-20 avec déuce (personne à 21)', () => {
    expect(isSetComplete(20, 20, regle21)).toBe(false)
  })

  it("retourne false pour 21-20 avec déuce (pas encore 2 points d'écart)", () => {
    expect(isSetComplete(21, 20, regle21)).toBe(false)
  })

  it('retourne true pour 21-19 avec déuce (écart ≥ 2)', () => {
    expect(isSetComplete(21, 19, regle21)).toBe(true)
  })

  it('retourne true pour 22-20 avec déuce (en déuce terminé)', () => {
    expect(isSetComplete(22, 20, regle21)).toBe(true)
  })

  it('retourne true pour 30-29 — golden point (maxScore atteint)', () => {
    expect(isSetComplete(30, 29, regle21)).toBe(true)
  })

  it('retourne true pour 30-28 avec déuce et golden point à 30', () => {
    expect(isSetComplete(30, 28, regle21)).toBe(true)
  })

  it('retourne false pour 29-29 avec déuce et maxScore=30 (pas encore au golden)', () => {
    expect(isSetComplete(29, 29, regle21)).toBe(false)
  })

  it('retourne true pour 11-8 sans déuce (premier à 11)', () => {
    expect(isSetComplete(11, 8, regle11SansDeuce)).toBe(true)
  })

  it('retourne true pour 11-0 sans déuce', () => {
    expect(isSetComplete(11, 0, regle11SansDeuce)).toBe(true)
  })

  it('retourne false pour 10-9 sans déuce (personne à 11)', () => {
    expect(isSetComplete(10, 9, regle11SansDeuce)).toBe(false)
  })

  it('retourne true pour 15-13 avec règle 15pts (déuce terminé)', () => {
    expect(isSetComplete(15, 13, regle15)).toBe(true)
  })

  it("retourne false pour 15-14 avec règle 15pts (1 seul point d'écart)", () => {
    expect(isSetComplete(15, 14, regle15)).toBe(false)
  })

  it('retourne true pour 17-16 — golden point à 17 (règle 15pts)', () => {
    expect(isSetComplete(17, 16, regle15)).toBe(true)
  })
})

// ─── getSetWinner ─────────────────────────────────────────────────────────────

describe('getSetWinner', () => {
  it('retourne "A" si A a gagné le set', () => {
    expect(getSetWinner(21, 15, regle21)).toBe('A')
  })

  it('retourne "B" si B a gagné le set', () => {
    expect(getSetWinner(15, 21, regle21)).toBe('B')
  })

  it("retourne null si le set n'est pas terminé", () => {
    expect(getSetWinner(20, 19, regle21)).toBeNull()
  })

  it('retourne null pour 21-20 (déuce non résolu)', () => {
    expect(getSetWinner(21, 20, regle21)).toBeNull()
  })

  it('retourne "B" pour 30-30 — impossible, le set devrait être terminé avant', () => {
    // 29-30 : B a le golden point
    expect(getSetWinner(29, 30, regle21)).toBe('B')
  })

  it('retourne "A" pour 11-0 sans déuce', () => {
    expect(getSetWinner(11, 0, regle11SansDeuce)).toBe('A')
  })
})

// ─── computeMatchResult ───────────────────────────────────────────────────────

describe('computeMatchResult', () => {
  it('retourne un résultat vide pour un match sans aucun score', () => {
    const scores: MatchScore[] = []
    const result = computeMatchResult(scores, regle21)
    expect(result.setsA).toBe(0)
    expect(result.setsB).toBe(0)
    expect(result.sets).toHaveLength(0)
    expect(result.winner).toBeNull()
    expect(result.isComplete).toBe(false)
  })

  it('retourne le bon résultat pour un match terminé en 2 sets (A gagne)', () => {
    const scores: MatchScore[] = [
      { id: 1, matchId: 1, setNumber: 1, scoreA: 21, scoreB: 15 },
      { id: 2, matchId: 1, setNumber: 2, scoreA: 21, scoreB: 18 },
    ]
    const result = computeMatchResult(scores, regle21)
    expect(result.setsA).toBe(2)
    expect(result.setsB).toBe(0)
    expect(result.winner).toBe('A')
    expect(result.isComplete).toBe(true)
  })

  it('retourne le bon résultat pour un match terminé en 2 sets (B gagne)', () => {
    const scores: MatchScore[] = [
      { id: 1, matchId: 1, setNumber: 1, scoreA: 15, scoreB: 21 },
      { id: 2, matchId: 1, setNumber: 2, scoreA: 18, scoreB: 21 },
    ]
    const result = computeMatchResult(scores, regle21)
    expect(result.setsA).toBe(0)
    expect(result.setsB).toBe(2)
    expect(result.winner).toBe('B')
    expect(result.isComplete).toBe(true)
  })

  it('retourne le bon résultat pour un match terminé en 3 sets (A gagne 2-1)', () => {
    const scores: MatchScore[] = [
      { id: 1, matchId: 1, setNumber: 1, scoreA: 21, scoreB: 18 },
      { id: 2, matchId: 1, setNumber: 2, scoreA: 14, scoreB: 21 },
      { id: 3, matchId: 1, setNumber: 3, scoreA: 21, scoreB: 17 },
    ]
    const result = computeMatchResult(scores, regle21)
    expect(result.setsA).toBe(2)
    expect(result.setsB).toBe(1)
    expect(result.winner).toBe('A')
    expect(result.isComplete).toBe(true)
    expect(result.sets[1].winner).toBe('B')
  })

  it('retourne isComplete=false pour un match en cours (set 2 non terminé)', () => {
    const scores: MatchScore[] = [
      { id: 1, matchId: 1, setNumber: 1, scoreA: 21, scoreB: 15 },
      { id: 2, matchId: 1, setNumber: 2, scoreA: 10, scoreB: 8 },
    ]
    const result = computeMatchResult(scores, regle21)
    expect(result.isComplete).toBe(false)
    expect(result.winner).toBeNull()
    expect(result.setsA).toBe(1)
    expect(result.setsB).toBe(0)
  })

  it('retourne le bon résultat pour un set unique (setsToWin=1)', () => {
    const scores: MatchScore[] = [
      { id: 1, matchId: 1, setNumber: 1, scoreA: 11, scoreB: 7 },
    ]
    const result = computeMatchResult(scores, regle11SansDeuce)
    expect(result.setsA).toBe(1)
    expect(result.setsB).toBe(0)
    expect(result.winner).toBe('A')
    expect(result.isComplete).toBe(true)
  })
})

// ─── getCurrentSet ────────────────────────────────────────────────────────────

describe('getCurrentSet', () => {
  it("retourne 1 si aucun score n'existe encore (match non commencé)", () => {
    expect(getCurrentSet([], regle21)).toBe(1)
  })

  it('retourne 2 si le set 1 est terminé', () => {
    const scores: MatchScore[] = [
      { id: 1, matchId: 1, setNumber: 1, scoreA: 21, scoreB: 15 },
    ]
    expect(getCurrentSet(scores, regle21)).toBe(2)
  })

  it('retourne 2 si le set 2 est en cours', () => {
    const scores: MatchScore[] = [
      { id: 1, matchId: 1, setNumber: 1, scoreA: 21, scoreB: 15 },
      { id: 2, matchId: 1, setNumber: 2, scoreA: 10, scoreB: 8 },
    ]
    expect(getCurrentSet(scores, regle21)).toBe(2)
  })

  it('retourne 3 si les sets 1 et 2 sont terminés (match à 3 sets)', () => {
    const scores: MatchScore[] = [
      { id: 1, matchId: 1, setNumber: 1, scoreA: 21, scoreB: 15 },
      { id: 2, matchId: 1, setNumber: 2, scoreA: 18, scoreB: 21 },
    ]
    expect(getCurrentSet(scores, regle21)).toBe(3)
  })

  it('retourne null si le match est terminé', () => {
    const scores: MatchScore[] = [
      { id: 1, matchId: 1, setNumber: 1, scoreA: 21, scoreB: 15 },
      { id: 2, matchId: 1, setNumber: 2, scoreA: 21, scoreB: 18 },
    ]
    expect(getCurrentSet(scores, regle21)).toBeNull()
  })

  it('retourne null si le match set unique est terminé', () => {
    const scores: MatchScore[] = [
      { id: 1, matchId: 1, setNumber: 1, scoreA: 11, scoreB: 5 },
    ]
    expect(getCurrentSet(scores, regle11SansDeuce)).toBeNull()
  })
})

// ─── formatMatchScore ─────────────────────────────────────────────────────────

describe('formatMatchScore', () => {
  it('formate correctement un match terminé en 2 sets', () => {
    const result: MatchResult = {
      setsA: 2,
      setsB: 0,
      sets: [
        { scoreA: 21, scoreB: 15, winner: 'A' },
        { scoreA: 21, scoreB: 18, winner: 'A' },
      ],
      winner: 'A',
      isComplete: true,
    }
    expect(formatMatchScore(result)).toBe('2-0 (21-15 21-18)')
  })

  it('formate correctement un match terminé en 3 sets', () => {
    const result: MatchResult = {
      setsA: 2,
      setsB: 1,
      sets: [
        { scoreA: 21, scoreB: 18, winner: 'A' },
        { scoreA: 19, scoreB: 21, winner: 'B' },
        { scoreA: 21, scoreB: 15, winner: 'A' },
      ],
      winner: 'A',
      isComplete: true,
    }
    expect(formatMatchScore(result)).toBe('2-1 (21-18 19-21 21-15)')
  })

  it('formate correctement un match en cours (0 sets terminés)', () => {
    const result: MatchResult = {
      setsA: 0,
      setsB: 0,
      sets: [],
      winner: null,
      isComplete: false,
    }
    expect(formatMatchScore(result)).toBe('0-0 ()')
  })

  it('formate correctement un match en cours avec 1 set terminé', () => {
    const result: MatchResult = {
      setsA: 1,
      setsB: 0,
      sets: [
        { scoreA: 21, scoreB: 15, winner: 'A' },
        { scoreA: 10, scoreB: 8, winner: null },
      ],
      winner: null,
      isComplete: false,
    }
    expect(formatMatchScore(result)).toBe('1-0 (21-15 10-8)')
  })
})
