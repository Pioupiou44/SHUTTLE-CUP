/**
 * Générateur Round Robin (poules) — chaque joueur joue contre tous les autres.
 * Algorithme de rotation (polygonal round-robin scheduling).
 */

import type { Match } from '@/types/domain'

export interface RoundRobinConfig {
  tournamentId: number
  /** Nombre de terrains disponibles */
  courtCount: number
}

/**
 * Génère tous les matchs d'un groupe en Round Robin.
 * @param playerIds - IDs des joueurs du groupe (ordre quelconque)
 * @param config    - Configuration du tournoi
 * @returns Liste de matchs sans ID (à insérer en BDD)
 */
export function generateRoundRobin(
  playerIds: number[],
  config: RoundRobinConfig
): Omit<Match, 'id' | 'winnerId' | 'comment'>[] {
  const players = [...playerIds]

  // Si nombre impair, ajoute un "bye" (null = repos)
  if (players.length % 2 !== 0) players.push(-1)

  const n = players.length
  const rounds: Omit<Match, 'id' | 'winnerId' | 'comment'>[][] = []

  for (let round = 0; round < n - 1; round++) {
    const roundMatches: Omit<Match, 'id' | 'winnerId' | 'comment'>[] = []
    let court = 1

    for (let i = 0; i < n / 2; i++) {
      const home = players[i]
      const away = players[n - 1 - i]

      // Ignore les matchs impliquant un bye
      if (home !== -1 && away !== -1) {
        roundMatches.push({
          tournamentId: config.tournamentId,
          round: round + 1,
          courtNumber: court <= config.courtCount ? court : undefined,
          status: 'pending',
          teamA: String(home),
          teamB: String(away),
        })
        court++
      }
    }

    rounds.push(roundMatches)

    // Rotation : le premier joueur est fixe, les autres tournent
    const last = players[n - 1]
    for (let i = n - 1; i > 1; i--) players[i] = players[i - 1]
    players[1] = last
  }

  return rounds.flat()
}

/**
 * Calcule le nombre de matchs total pour N joueurs en Round Robin.
 */
export function countRoundRobinMatches(playerCount: number): number {
  return (playerCount * (playerCount - 1)) / 2
}

/**
 * Estime la durée totale d'un Round Robin en minutes.
 * @param playerCount - Nombre de joueurs
 * @param courtCount  - Nombre de terrains
 * @param minutesPerMatch - Durée estimée par match (défaut 20 min)
 */
export function estimateDuration(
  playerCount: number,
  courtCount: number,
  minutesPerMatch = 20
): number {
  const total = countRoundRobinMatches(playerCount)
  // matchs en parallèle par ronde = courtCount
  const rounds = Math.ceil(total / Math.max(1, courtCount))
  return rounds * minutesPerMatch
}
