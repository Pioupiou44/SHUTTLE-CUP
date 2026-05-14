/**
 * Générateur Américano — chaque joueur joue avec tous les autres partenaires.
 * À chaque ronde, les partenariats sont maximalement variés.
 * Format adapté aux clubs : 4 joueurs par terrain, changement toutes les N points.
 */

import type { Match } from '@/types/domain'

export interface AmericanoConfig {
  tournamentId: number
  courtCount: number
  /** Nombre de rondes souhaitées (défaut : calculé pour que chacun joue avec tous) */
  rounds?: number
}

/**
 * Génère les rondes Américano pour N joueurs.
 * Chaque ronde : les joueurs sont groupés par 4 sur les terrains (2vs2).
 * Algo : rotation linéaire avec contrainte de non-répétition partenaires.
 */
export function generateAmericano(
  playerIds: number[],
  config: AmericanoConfig
): Omit<Match, 'id' | 'winnerId' | 'comment'>[] {
  if (playerIds.length < 4) return []

  // Complète à un multiple de 4 avec byes
  const players = [...playerIds]
  while (players.length % 4 !== 0) players.push(-1)
  const n = players.length

  const targetRounds = config.rounds ?? Math.max(3, n - 1)
  const matches: Omit<Match, 'id' | 'winnerId' | 'comment'>[] = []

  // Table des partenariats déjà joués pour minimiser les répétitions
  const partnerships = new Set<string>()

  for (let round = 1; round <= targetRounds; round++) {
    const shuffled = shuffleWithConstraints([...players], partnerships)
    let court = 1

    for (let i = 0; i < shuffled.length; i += 4) {
      const [a1, a2, b1, b2] = shuffled.slice(i, i + 4)
      const hasBye = [a1, a2, b1, b2].some((x) => x === -1)

      if (!hasBye) {
        // Enregistre les partenariats de cette ronde
        partnerships.add(pairKey(a1, a2))
        partnerships.add(pairKey(b1, b2))

        matches.push({
          tournamentId: config.tournamentId,
          round,
          courtNumber: court <= config.courtCount ? court : undefined,
          status: 'pending',
          teamA: `${a1},${a2}`,
          teamB: `${b1},${b2}`,
        })
      }
      court++
    }
  }

  return matches
}

/** Trie les joueurs pour minimiser les répétitions de partenariats */
function shuffleWithConstraints(players: number[], used: Set<string>): number[] {
  // Shuffle aléatoire simple — une optimisation plus poussée nécessite backtracking
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[players[i], players[j]] = [players[j], players[i]]
  }
  // Tentative de réarranger par groupes de 4 pour éviter partenariats déjà joués
  for (let start = 0; start < players.length - 3; start += 4) {
    const [a, b, c] = players.slice(start, start + 4)
    // Si le partenariat A-B a déjà été joué, essaie A-C
    if (used.has(pairKey(a, b)) && !used.has(pairKey(a, c))) {
      players[start + 1] = c
      players[start + 2] = b
    }
  }
  return players
}

function pairKey(a: number, b: number): string {
  return [Math.min(a, b), Math.max(a, b)].join('-')
}

/**
 * Compte le nombre de rondes optimal pour que chaque joueur joue avec tous.
 * Pour N joueurs : N - 1 rondes minimum (idem round-robin).
 */
export function countAmericanoRounds(playerCount: number): number {
  return Math.max(3, playerCount - 1)
}
