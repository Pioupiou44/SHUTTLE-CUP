/**
 * Calcul du classement pour un tournoi en poules (Round Robin).
 * Logique pure, testable Vitest.
 */

import type { Match, MatchScore } from '@/types/domain'
import { computeMatchResult } from './scoring'
import type { ScoringRule } from '@/types/domain'

export interface StandingEntry {
  playerId: number
  playerName: string
  matchesPlayed: number
  matchesWon: number
  matchesLost: number
  setsWon: number
  setsLost: number
  pointsWon: number
  pointsLost: number
  /** Points de classement : 2 pts victoire, 1 pt défaite, 0 pt forfait */
  rankPoints: number
  /** Ratio sets (pour départager) */
  setRatio: number
  /** Ratio points (pour départager) */
  pointRatio: number
}

export interface HeadToHeadRecord {
  playerAId: number
  playerBId: number
  winner: number | null // playerId du gagnant, ou null si non joué
}

/**
 * Calcule le classement complet d'un groupe de joueurs.
 * @param playerIds  - Liste des IDs participants
 * @param playerNames - Map playerId → nom affiché
 * @param matches    - Matchs du groupe (avec scores)
 * @param scores     - Tous les scores indexés par matchId
 * @param rule       - Règle de scoring
 */
export function computeStandings(
  playerIds: number[],
  playerNames: Map<number, string>,
  matches: Match[],
  scores: Map<number, MatchScore[]>,
  rule: ScoringRule
): StandingEntry[] {
  // Initialise les entrées
  const entries = new Map<number, StandingEntry>()
  for (const id of playerIds) {
    entries.set(id, {
      playerId: id,
      playerName: playerNames.get(id) ?? `Joueur ${id}`,
      matchesPlayed: 0,
      matchesWon: 0,
      matchesLost: 0,
      setsWon: 0,
      setsLost: 0,
      pointsWon: 0,
      pointsLost: 0,
      rankPoints: 0,
      setRatio: 0,
      pointRatio: 0,
    })
  }

  for (const match of matches) {
    if (match.status !== 'completed' && match.status !== 'walkover') continue

    const matchScores = scores.get(match.id) ?? []
    const result = computeMatchResult(matchScores, rule)
    if (!result.winner) continue

    // Identifie A et B depuis le match (teamA/teamB contiennent les IDs séparés par ',')
    const idA = parseTeamId(match.teamA)
    const idB = parseTeamId(match.teamB)
    if (!idA || !idB) continue

    const entryA = entries.get(idA)
    const entryB = entries.get(idB)
    if (!entryA || !entryB) continue

    entryA.matchesPlayed++
    entryB.matchesPlayed++

    for (const set of result.sets) {
      if (set.winner === null) continue
      entryA.setsWon   += result.sets.filter((s) => s.winner === 'A').length > 0 ? (set.winner === 'A' ? 1 : 0) : 0
      entryA.setsLost  += set.winner === 'B' ? 1 : 0
      entryB.setsWon   += set.winner === 'B' ? 1 : 0
      entryB.setsLost  += set.winner === 'A' ? 1 : 0
      entryA.pointsWon  += set.scoreA
      entryA.pointsLost += set.scoreB
      entryB.pointsWon  += set.scoreB
      entryB.pointsLost += set.scoreA
    }

    if (result.winner === 'A') {
      entryA.matchesWon++
      entryA.rankPoints += 2
      entryB.matchesLost++
      entryB.rankPoints += match.status === 'walkover' ? 0 : 1
    } else {
      entryB.matchesWon++
      entryB.rankPoints += 2
      entryA.matchesLost++
      entryA.rankPoints += match.status === 'walkover' ? 0 : 1
    }
  }

  // Calcule les ratios
  for (const e of entries.values()) {
    e.setRatio   = e.setsLost   === 0 ? e.setsWon   : e.setsWon   / e.setsLost
    e.pointRatio = e.pointsLost === 0 ? e.pointsWon : e.pointsWon / e.pointsLost
  }

  // Tri : rankPoints → setRatio → pointRatio → head-to-head (simplifié)
  return Array.from(entries.values()).sort((a, b) => {
    if (b.rankPoints !== a.rankPoints) return b.rankPoints - a.rankPoints
    if (b.setRatio   !== a.setRatio)   return b.setRatio   - a.setRatio
    return b.pointRatio - a.pointRatio
  })
}

function parseTeamId(team: string | undefined): number | null {
  if (!team) return null
  const n = parseInt(team, 10)
  return isNaN(n) ? null : n
}
