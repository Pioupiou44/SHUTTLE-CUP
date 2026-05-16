/**
 * Générateur King of Court (Roi du court).
 * Chaque terrain accueille 2 unités (joueur simple ou paire en doubles).
 * Règle : le vainqueur monte d'un terrain, le perdant descend.
 */

import type { Match } from '@/types/domain'

export interface KingOfCourtConfig {
  tournamentId: number
  courtCount: number
}

/**
 * Génère la première ronde d'un King of Court.
 * Les unités (joueurs ou indices de paires) sont réparties : court 1 = meilleurs (ordre du tableau fourni).
 */
export function generateKingOfCourtRound1(
  unitIds: number[],
  config: KingOfCourtConfig
): Omit<Match, 'id' | 'winnerId' | 'comment'>[] {
  if (unitIds.length < 2) return []
  const activeCourts = Math.min(config.courtCount, Math.floor(unitIds.length / 2))
  const matches: Omit<Match, 'id' | 'winnerId' | 'comment'>[] = []
  for (let c = 0; c < activeCourts; c++) {
    matches.push({
      tournamentId: config.tournamentId,
      round: 1,
      courtNumber: c + 1,
      status: 'pending',
      teamA: String(unitIds[c * 2]),
      teamB: String(unitIds[c * 2 + 1]),
    })
  }
  return matches
}

/**
 * Génère la ronde suivante d'un King of Court.
 * Algorithme de classement : vainqueurs par terrain croissant, puis perdants, puis file d'attente.
 * Ré-appariement : 1er vs 2e (court 1), 3e vs 4e (court 2), etc.
 *
 * @param previousMatches - Matchs du tour précédent (avec résultats), triables par courtNumber
 * @param queueUnits      - Unités (teamA/teamB strings) en file d'attente (absentes du tour précédent)
 * @param roundNumber     - Numéro de la prochaine ronde
 */
export function generateNextKingOfCourtRound(
  previousMatches: Pick<Match, 'courtNumber' | 'winnerSide' | 'teamA' | 'teamB'>[],
  queueUnits: string[],
  roundNumber: number,
  config: KingOfCourtConfig
): Omit<Match, 'id' | 'winnerId' | 'comment'>[] {
  const sorted = [...previousMatches].sort((a, b) => (a.courtNumber ?? 99) - (b.courtNumber ?? 99))
  const courtCount = sorted.length
  if (courtCount === 0) return []

  // Classement : gagnants d'abord (terrain 1 → terrain N), puis perdants, puis file d'attente
  const ranked: string[] = []
  for (const m of sorted) {
    const w = m.winnerSide === 'A' ? m.teamA : m.winnerSide === 'B' ? m.teamB : m.teamA
    if (w) ranked.push(w)
  }
  for (const m of sorted) {
    const l = m.winnerSide === 'A' ? m.teamB : m.winnerSide === 'B' ? m.teamA : m.teamB
    if (l) ranked.push(l)
  }
  ranked.push(...queueUnits)

  const matches: Omit<Match, 'id' | 'winnerId' | 'comment'>[] = []
  for (let c = 0; c < courtCount && c * 2 + 1 < ranked.length; c++) {
    matches.push({
      tournamentId: config.tournamentId,
      round: roundNumber,
      courtNumber: c + 1,
      status: 'pending',
      teamA: ranked[c * 2],
      teamB: ranked[c * 2 + 1],
    })
  }
  return matches
}
