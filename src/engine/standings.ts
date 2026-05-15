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
 * @param playerIds   - Liste des IDs participants
 * @param playerNames - Map playerId → nom affiché
 * @param matches     - Matchs du groupe (avec scores)
 * @param scores      - Tous les scores indexés par matchId
 * @param rule        - Règle de scoring (optionnelle — fallback sur winnerSide DB)
 */
export function computeStandings(
  playerIds: number[],
  playerNames: Map<number, string>,
  matches: Match[],
  scores: Map<number, MatchScore[]>,
  rule: ScoringRule | undefined
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

    // Tentative de calcul du vainqueur via les scores + règle
    let winner: 'A' | 'B' | null = null
    let setsWonA = 0
    let setsWonB = 0
    let ptWonA = 0
    let ptWonB = 0

    if (rule && matchScores.length > 0) {
      const result = computeMatchResult(matchScores, rule)
      winner = result.winner
      setsWonA = result.sets.filter((s) => s.winner === 'A').length
      setsWonB = result.sets.filter((s) => s.winner === 'B').length
      ptWonA = result.sets.reduce((acc, s) => acc + s.scoreA, 0)
      ptWonB = result.sets.reduce((acc, s) => acc + s.scoreB, 0)
    }

    // Fallback : utilise winnerSide stocké en DB (ex. si la règle est absente ou scores incomplets)
    if (!winner && match.winnerSide) {
      winner = match.winnerSide
      ptWonA = matchScores.reduce((acc, s) => acc + s.scoreA, 0)
      ptWonB = matchScores.reduce((acc, s) => acc + s.scoreB, 0)
      // Estimation sets conservatrice : 1-0 ou 0-1 (sans rule, on ne peut pas compter les sets exacts)
      setsWonA = winner === 'A' ? 1 : 0
      setsWonB = winner === 'B' ? 1 : 0
    }

    if (!winner) continue

    // Extrait TOUS les IDs de chaque équipe (1 en simple, 2 en double)
    const idsA = parseTeamIds(match.teamA)
    const idsB = parseTeamIds(match.teamB)
    if (idsA.length === 0 || idsB.length === 0) continue

    // Applique les résultats à tous les membres de chaque équipe
    for (const idA of idsA) {
      const e = entries.get(idA)
      if (!e) continue
      e.matchesPlayed++
      e.setsWon   += setsWonA
      e.setsLost  += setsWonB
      e.pointsWon  += ptWonA
      e.pointsLost += ptWonB
      if (winner === 'A') {
        e.matchesWon++
        e.rankPoints += 2
      } else {
        e.matchesLost++
        e.rankPoints += match.status === 'walkover' ? 0 : 1
      }
    }

    for (const idB of idsB) {
      const e = entries.get(idB)
      if (!e) continue
      e.matchesPlayed++
      e.setsWon   += setsWonB
      e.setsLost  += setsWonA
      e.pointsWon  += ptWonB
      e.pointsLost += ptWonA
      if (winner === 'B') {
        e.matchesWon++
        e.rankPoints += 2
      } else {
        e.matchesLost++
        e.rankPoints += match.status === 'walkover' ? 0 : 1
      }
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

/** Extrait tous les IDs joueurs d'une équipe (séparés par ',') */
function parseTeamIds(team: string | undefined): number[] {
  if (!team) return []
  return team.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
}
