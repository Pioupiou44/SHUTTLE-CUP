/**
 * Générateur tableau à élimination directe (Single Elimination).
 * Gère automatiquement les byes pour atteindre la prochaine puissance de 2.
 */

import type { Match } from '@/types/domain'

/**
 * Génère le bracket complet d'un tournoi à élimination directe.
 * Les joueurs sont placés par seed (index 0 = tête de série 1).
 * @param playerIds  - IDs joueurs ordonnés par seed
 * @param tournamentId
 * @returns Matchs du premier tour (les suivants sont créés au fur et à mesure)
 */
export function generateSingleElim(
  playerIds: number[],
  tournamentId: number
): Omit<Match, 'id' | 'winnerId' | 'comment'>[] {
  const bracketSize = nextPowerOf2(playerIds.length)
  const byes = bracketSize - playerIds.length

  // Placement par seed : 1 vs last, 2 vs (last-1), etc.
  const seeded = seededBracket(playerIds, bracketSize)

  const matches: Omit<Match, 'id' | 'winnerId' | 'comment'>[] = []
  const totalRounds = Math.log2(bracketSize)

  for (let i = 0; i < bracketSize / 2; i++) {
    const playerA = seeded[i * 2]
    const playerB = seeded[i * 2 + 1]

    // Bye : l'un des deux est null → match automatiquement gagné par le joueur présent
    const isBye = playerA === null || playerB === null
    matches.push({
      tournamentId,
      round: 1,
      status: isBye ? 'completed' : 'pending',
      teamA: playerA !== null ? String(playerA) : 'BYE',
      teamB: playerB !== null ? String(playerB) : 'BYE',
    })
  }

  // Rounds suivants générés comme matchs vides (remplis à mesure des victoires)
  let matchesInRound = bracketSize / 4
  for (let round = 2; round <= totalRounds; round++) {
    for (let i = 0; i < matchesInRound; i++) {
      matches.push({
        tournamentId,
        round,
        status: 'pending',
        teamA: undefined,
        teamB: undefined,
      })
    }
    matchesInRound = Math.max(1, matchesInRound / 2)
  }

  void byes // utilisé implicitement via seededBracket

  return matches
}

/**
 * Retourne la prochaine puissance de 2 ≥ n.
 */
export function nextPowerOf2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

/**
 * Place les joueurs dans le bracket seeded standard.
 * Algorithme de doublement : [1,2] → [1,4,2,3] → [1,8,4,5,2,7,3,6] …
 * Chaque seed s est complété par (taille+1-s) à chaque étape.
 * Garantit : seed1 vs seed(n), seed2 vs seed(n-1), etc. en R1.
 */
function seededBracket(playerIds: number[], size: number): (number | null)[] {
  // Construction de la liste des seeds dans l'ordre du bracket
  let seeds = [1, 2]
  let currentSize = 2
  while (currentSize < size) {
    currentSize *= 2
    seeds = seeds.flatMap((s) => [s, currentSize + 1 - s])
  }

  return seeds.map((seedNum) => {
    const idx = seedNum - 1 // seed 1-indexé → indice 0-indexé
    return idx < playerIds.length ? playerIds[idx] : null
  })
}
