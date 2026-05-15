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

  // Nombre de joueurs actifs par ronde = plus grand multiple de 4 ≤ playerIds.length
  const activePlayers = Math.floor(playerIds.length / 4) * 4
  const benchCount = playerIds.length - activePlayers // joueurs au banc à chaque ronde

  // Nombre de rondes basé sur le vrai count, pas le count paddé
  const targetRounds = config.rounds ?? Math.max(3, playerIds.length - 1)
  const matches: Omit<Match, 'id' | 'winnerId' | 'comment'>[] = []

  // Table des partenariats déjà joués pour minimiser les répétitions
  const partnerships = new Set<string>()

  // Rotation équitable du banc : chaque joueur attend à tour de rôle
  const benchRotation = [...playerIds]

  for (let round = 1; round <= targetRounds; round++) {
    // Sélectionne les joueurs au banc pour cette ronde (rotation circulaire)
    const benchStart = ((round - 1) * benchCount) % playerIds.length
    const benchSet = new Set<number>()
    for (let b = 0; b < benchCount; b++) {
      benchSet.add(benchRotation[(benchStart + b) % benchRotation.length])
    }
    const playing = playerIds.filter((p) => !benchSet.has(p))

    const shuffled = shuffleWithConstraints([...playing], partnerships)
    let court = 1

    for (let i = 0; i + 3 < shuffled.length; i += 4) {
      const [a1, a2, b1, b2] = shuffled.slice(i, i + 4)

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
