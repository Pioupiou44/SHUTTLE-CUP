/**
 * Tests unitaires — générateur Single Elimination
 * Couvre : nextPowerOf2, generateSingleElim
 */

import { describe, it, expect } from 'vitest'
import { generateSingleElim, nextPowerOf2 } from '@/engine/generators/singleElim'

// ─── nextPowerOf2 ─────────────────────────────────────────────────────────────

describe('nextPowerOf2', () => {
  it('1 → 1', () => expect(nextPowerOf2(1)).toBe(1))
  it('2 → 2', () => expect(nextPowerOf2(2)).toBe(2))
  it('3 → 4', () => expect(nextPowerOf2(3)).toBe(4))
  it('4 → 4', () => expect(nextPowerOf2(4)).toBe(4))
  it('5 → 8', () => expect(nextPowerOf2(5)).toBe(8))
  it('7 → 8', () => expect(nextPowerOf2(7)).toBe(8))
  it('8 → 8', () => expect(nextPowerOf2(8)).toBe(8))
  it('9 → 16', () => expect(nextPowerOf2(9)).toBe(16))
  it('16 → 16', () => expect(nextPowerOf2(16)).toBe(16))
  it('17 → 32', () => expect(nextPowerOf2(17)).toBe(32))
})

// ─── generateSingleElim ───────────────────────────────────────────────────────

describe('generateSingleElim', () => {
  it('génère 3 matchs pour 4 joueurs (2 R1 + 1 R2 placeholder)', () => {
    const matches = generateSingleElim([1, 2, 3, 4], 1)
    expect(matches).toHaveLength(3)
  })

  it('génère 7 matchs pour 8 joueurs (4 R1 + 2 R2 + 1 R3)', () => {
    const matches = generateSingleElim([1, 2, 3, 4, 5, 6, 7, 8], 1)
    expect(matches).toHaveLength(7)
  })

  it('génère 15 matchs pour 16 joueurs', () => {
    const matches = generateSingleElim([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 1)
    expect(matches).toHaveLength(15)
  })

  it('pour 3 joueurs : bracket de 4 avec 1 bye en R1', () => {
    // nextPowerOf2(3) = 4 → 2 matchs R1 dont 1 BYE + 1 R2 placeholder = 3 matchs
    const matches = generateSingleElim([1, 2, 3], 1)
    expect(matches).toHaveLength(3)
    const r1 = matches.filter((m) => m.round === 1)
    const byes = r1.filter((m) => m.teamA === 'BYE' || m.teamB === 'BYE')
    expect(byes).toHaveLength(1)
  })

  it('pour 5 joueurs : bracket de 8 avec 3 byes en R1', () => {
    const matches = generateSingleElim([1, 2, 3, 4, 5], 1)
    // 4 matchs R1 + 2 R2 + 1 R3 = 7 matchs
    expect(matches).toHaveLength(7)
    const r1 = matches.filter((m) => m.round === 1)
    const byes = r1.filter((m) => m.teamA === 'BYE' || m.teamB === 'BYE')
    expect(byes).toHaveLength(3)
  })

  it('matchs R1 sans bye ont status "pending"', () => {
    const matches = generateSingleElim([1, 2, 3, 4], 1)
    const r1NonBye = matches.filter(
      (m) => m.round === 1 && m.teamA !== 'BYE' && m.teamB !== 'BYE'
    )
    expect(r1NonBye.every((m) => m.status === 'pending')).toBe(true)
  })

  it('matchs R1 avec bye ont status "completed"', () => {
    const matches = generateSingleElim([1, 2, 3], 1)
    const r1Bye = matches.filter(
      (m) => m.round === 1 && (m.teamA === 'BYE' || m.teamB === 'BYE')
    )
    expect(r1Bye.every((m) => m.status === 'completed')).toBe(true)
  })

  it('matchs R2+ (placeholders) ont teamA et teamB undefined', () => {
    const matches = generateSingleElim([1, 2, 3, 4], 1)
    const r2Plus = matches.filter((m) => (m.round ?? 0) >= 2)
    expect(r2Plus.every((m) => m.teamA === undefined && m.teamB === undefined)).toBe(true)
  })

  it('matchs R2+ ont status "pending"', () => {
    const matches = generateSingleElim([1, 2, 3, 4], 1)
    const r2Plus = matches.filter((m) => (m.round ?? 0) >= 2)
    expect(r2Plus.every((m) => m.status === 'pending')).toBe(true)
  })

  it('tous les matchs ont le tournamentId correct', () => {
    const matches = generateSingleElim([1, 2, 3, 4], 99)
    expect(matches.every((m) => m.tournamentId === 99)).toBe(true)
  })

  it('les joueurs R1 sans bye contiennent exactement les joueurs fournis (4 joueurs)', () => {
    const matches = generateSingleElim([1, 2, 3, 4], 1)
    const r1 = matches.filter((m) => m.round === 1)
    const players = r1
      .flatMap((m) => [m.teamA, m.teamB])
      .filter((t) => t !== 'BYE' && t !== undefined)
      .map(Number)
    expect(new Set(players).size).toBe(4)
    expect(players.sort((a, b) => a - b)).toEqual([1, 2, 3, 4])
  })

  it('8 joueurs → 0 byes en R1', () => {
    const matches = generateSingleElim([1, 2, 3, 4, 5, 6, 7, 8], 1)
    const r1 = matches.filter((m) => m.round === 1)
    const byes = r1.filter((m) => m.teamA === 'BYE' || m.teamB === 'BYE')
    expect(byes).toHaveLength(0)
  })

  it('le nombre de rounds est log2(bracketSize) pour 4 joueurs (2 rounds)', () => {
    const matches = generateSingleElim([1, 2, 3, 4], 1)
    const maxRound = Math.max(...matches.map((m) => m.round ?? 0))
    expect(maxRound).toBe(2)
  })

  it('le nombre de rounds est log2(bracketSize) pour 8 joueurs (3 rounds)', () => {
    const matches = generateSingleElim([1, 2, 3, 4, 5, 6, 7, 8], 1)
    const maxRound = Math.max(...matches.map((m) => m.round ?? 0))
    expect(maxRound).toBe(3)
  })
})
