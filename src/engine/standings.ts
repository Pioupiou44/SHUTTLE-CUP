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

// ─── Américano ───────────────────────────────────────────────────────────────

export interface AmericanoStandingEntry {
  playerId: number
  playerName: string
  matchesPlayed: number
  wins: number
  losses: number
  /** Somme cumulée de tous les points marqués dans tous les matchs */
  totalPoints: number
}

/**
 * Calcule le classement américano individuel.
 * Rang = points cumulés → victoires → nom alphabétique.
 */
export function computeAmericanoStandings(
  playerIds: number[],
  playerNames: Map<number, string>,
  matches: Match[],
  scores: Map<number, MatchScore[]>
): AmericanoStandingEntry[] {
  const entries = new Map<number, AmericanoStandingEntry>()
  for (const id of playerIds) {
    entries.set(id, {
      playerId: id,
      playerName: playerNames.get(id) ?? `Joueur ${id}`,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      totalPoints: 0,
    })
  }

  for (const match of matches) {
    if (match.status !== 'completed' && match.status !== 'walkover') continue
    const matchScores = scores.get(match.id) ?? []
    const idsA = parseTeamIds(match.teamA)
    const idsB = parseTeamIds(match.teamB)
    if (idsA.length === 0 || idsB.length === 0) continue
    const ptA = matchScores.reduce((acc, s) => acc + s.scoreA, 0)
    const ptB = matchScores.reduce((acc, s) => acc + s.scoreB, 0)
    const winner = match.winnerSide
    for (const id of idsA) {
      const e = entries.get(id)
      if (!e) continue
      e.matchesPlayed++
      e.totalPoints += ptA
      if (winner === 'A') e.wins++
      else e.losses++
    }
    for (const id of idsB) {
      const e = entries.get(id)
      if (!e) continue
      e.matchesPlayed++
      e.totalPoints += ptB
      if (winner === 'B') e.wins++
      else e.losses++
    }
  }

  return Array.from(entries.values()).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    if (b.wins !== a.wins) return b.wins - a.wins
    return a.playerName.localeCompare(b.playerName)
  })
}

// ─── Swiss System ─────────────────────────────────────────────────────────────

export interface SwissStandingEntry {
  playerId: number
  playerName: string
  matchesPlayed: number
  wins: number
  losses: number
  /** Points suisses : 2=victoire, 1=défaite, 0=forfait. +2 pour bye automatique. */
  swissPoints: number
  /** Buchholz : somme des points suisses de tous les adversaires rencontrés */
  buchholz: number
}

/**
 * Calcule le classement Swiss avec indicateur Buchholz.
 * Les joueurs absents d'une ronde reçoivent automatiquement +2 pts (bye).
 */
export function computeSwissStandings(
  playerIds: number[],
  playerNames: Map<number, string>,
  matches: Match[],
  scores: Map<number, MatchScore[]>
): SwissStandingEntry[] {
  void scores // non utilisé dans Swiss (pas de points individuels)

  const ptsMap = new Map<number, number>(playerIds.map((id) => [id, 0]))
  const winsMap = new Map<number, number>(playerIds.map((id) => [id, 0]))
  const lossMap = new Map<number, number>(playerIds.map((id) => [id, 0]))
  const played = new Map<number, number[]>(playerIds.map((id) => [id, []]))
  const matchesPlayedMap = new Map<number, number>(playerIds.map((id) => [id, 0]))

  for (const match of matches) {
    if (match.status !== 'completed' && match.status !== 'walkover') continue
    const idA = parseInt(match.teamA ?? '', 10)
    const idB = parseInt(match.teamB ?? '', 10)
    if (isNaN(idA)) continue
    if (match.teamB === 'BYE' || isNaN(idB)) {
      // Bye explicite (teamB='BYE') — les byes silencieux sont traités séparément ci-dessous
      ptsMap.set(idA, (ptsMap.get(idA) ?? 0) + 2)
      winsMap.set(idA, (winsMap.get(idA) ?? 0) + 1)
      matchesPlayedMap.set(idA, (matchesPlayedMap.get(idA) ?? 0) + 1)
      continue
    }
    played.get(idA)?.push(idB)
    played.get(idB)?.push(idA)
    matchesPlayedMap.set(idA, (matchesPlayedMap.get(idA) ?? 0) + 1)
    matchesPlayedMap.set(idB, (matchesPlayedMap.get(idB) ?? 0) + 1)
    if (match.winnerSide === 'A') {
      ptsMap.set(idA, (ptsMap.get(idA) ?? 0) + 2)
      ptsMap.set(idB, (ptsMap.get(idB) ?? 0) + (match.status === 'walkover' ? 0 : 1))
      winsMap.set(idA, (winsMap.get(idA) ?? 0) + 1)
      lossMap.set(idB, (lossMap.get(idB) ?? 0) + 1)
    } else if (match.winnerSide === 'B') {
      ptsMap.set(idB, (ptsMap.get(idB) ?? 0) + 2)
      ptsMap.set(idA, (ptsMap.get(idA) ?? 0) + (match.status === 'walkover' ? 0 : 1))
      winsMap.set(idB, (winsMap.get(idB) ?? 0) + 1)
      lossMap.set(idA, (lossMap.get(idA) ?? 0) + 1)
    }
  }

  // Byes silencieux : joueurs absents d'une ronde existante reçoivent +2 pts
  const roundNumbers = [...new Set(matches.map((m) => m.round).filter((n): n is number => n != null))]
  for (const round of roundNumbers) {
    const roundMatches = matches.filter((m) => m.round === round)
    const presentIds = new Set<number>()
    for (const m of roundMatches) {
      const a = parseInt(m.teamA ?? '', 10)
      const b = parseInt(m.teamB ?? '', 10)
      if (!isNaN(a)) presentIds.add(a)
      if (!isNaN(b)) presentIds.add(b)
    }
    for (const id of playerIds) {
      if (!presentIds.has(id)) {
        ptsMap.set(id, (ptsMap.get(id) ?? 0) + 2)
        winsMap.set(id, (winsMap.get(id) ?? 0) + 1)
      }
    }
  }

  // Buchholz = somme des points suisses de tous les adversaires
  const result: SwissStandingEntry[] = playerIds.map((id) => {
    const oppIds = played.get(id) ?? []
    const buchholz = oppIds.reduce((sum, oppId) => sum + (ptsMap.get(oppId) ?? 0), 0)
    return {
      playerId: id,
      playerName: playerNames.get(id) ?? `Joueur ${id}`,
      matchesPlayed: matchesPlayedMap.get(id) ?? 0,
      wins: winsMap.get(id) ?? 0,
      losses: lossMap.get(id) ?? 0,
      swissPoints: ptsMap.get(id) ?? 0,
      buchholz,
    }
  })

  return result.sort((a, b) => {
    if (b.swissPoints !== a.swissPoints) return b.swissPoints - a.swissPoints
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz
    if (b.wins !== a.wins) return b.wins - a.wins
    return a.playerName.localeCompare(b.playerName)
  })
}

// ─── King of Court ────────────────────────────────────────────────────────────

export interface KingOfCourtStandingEntry {
  playerId: number
  playerName: string
  matchesPlayed: number
  /** Victoires sur le terrain 1 (le trône) */
  winsOnCourt1: number
  totalWins: number
  totalPoints: number
}

/**
 * Calcule le classement King of Court.
 * Rang = winsOnCourt1 → totalWins → totalPoints → nom alphabétique.
 */
export function computeKingOfCourtStandings(
  playerIds: number[],
  playerNames: Map<number, string>,
  matches: Match[],
  scores: Map<number, MatchScore[]>
): KingOfCourtStandingEntry[] {
  const entries = new Map<number, KingOfCourtStandingEntry>()
  for (const id of playerIds) {
    entries.set(id, {
      playerId: id,
      playerName: playerNames.get(id) ?? `Joueur ${id}`,
      matchesPlayed: 0,
      winsOnCourt1: 0,
      totalWins: 0,
      totalPoints: 0,
    })
  }

  for (const match of matches) {
    if (match.status !== 'completed' && match.status !== 'walkover') continue
    const matchScores = scores.get(match.id) ?? []
    const idsA = parseTeamIds(match.teamA)
    const idsB = parseTeamIds(match.teamB)
    if (idsA.length === 0 || idsB.length === 0) continue
    const ptA = matchScores.reduce((acc, s) => acc + s.scoreA, 0)
    const ptB = matchScores.reduce((acc, s) => acc + s.scoreB, 0)
    const isTrone = match.courtNumber === 1
    const winner = match.winnerSide
    for (const id of idsA) {
      const e = entries.get(id)
      if (!e) continue
      e.matchesPlayed++
      e.totalPoints += ptA
      if (winner === 'A') {
        e.totalWins++
        if (isTrone) e.winsOnCourt1++
      }
    }
    for (const id of idsB) {
      const e = entries.get(id)
      if (!e) continue
      e.matchesPlayed++
      e.totalPoints += ptB
      if (winner === 'B') {
        e.totalWins++
        if (isTrone) e.winsOnCourt1++
      }
    }
  }

  return Array.from(entries.values()).sort((a, b) => {
    if (b.winsOnCourt1 !== a.winsOnCourt1) return b.winsOnCourt1 - a.winsOnCourt1
    if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    return a.playerName.localeCompare(b.playerName)
  })
}
