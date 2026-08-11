/**
 * Générateur de rencontre par équipes (interclub).
 * Génère les matchs entre les joueurs de l'équipe A et de l'équipe B,
 * catégorie par catégorie, du meilleur ELO vers le moins bon.
 */

import type { Match, MatchCategory } from '@/types/domain'

export interface InterclubPlayer {
  id: number
  gender: 'M' | 'F' | 'X'
  elo?: number
  teamSide: 'A' | 'B'
}

/** Vérifie si un joueur est éligible à une catégorie simple. */
function eligibleSimple(p: InterclubPlayer, cat: MatchCategory): boolean {
  if (cat === 'SH') return p.gender === 'M'
  if (cat === 'SD') return p.gender === 'F'
  return false
}

/**
 * Génère les matchs d'une rencontre interclub.
 * - Simple Hommes (SH) et Simple Dames (SD) : 1 match par paire de joueurs, triés par ELO desc
 * - Les doubles (DH, DD, DX) ne sont pas gérés ici : ils utilisent le modal doubles existant
 */
export function generateInterclub(
  players: InterclubPlayer[],
  categories: MatchCategory[],
  tournamentId: number,
  courtCount: number
): Omit<Match, 'id' | 'winnerId'>[] {
  const matches: Omit<Match, 'id' | 'winnerId'>[] = []
  let courtCursor = 1

  const simpleCats = categories.filter((c) => c === 'SH' || c === 'SD')

  for (const cat of simpleCats) {
    const teamA = players
      .filter((p) => p.teamSide === 'A' && eligibleSimple(p, cat))
      .sort((a, b) => (b.elo ?? 1000) - (a.elo ?? 1000))
    const teamB = players
      .filter((p) => p.teamSide === 'B' && eligibleSimple(p, cat))
      .sort((a, b) => (b.elo ?? 1000) - (a.elo ?? 1000))

    const count = Math.min(teamA.length, teamB.length)
    for (let i = 0; i < count; i++) {
      matches.push({
        tournamentId,
        round: 1,
        courtNumber: ((courtCursor - 1) % courtCount) + 1,
        status: 'pending',
        category: cat,
        comment: `${cat} #${i + 1}`,
        teamA: String(teamA[i].id),
        teamB: String(teamB[i].id),
      })
      courtCursor++
    }
  }

  return matches
}
