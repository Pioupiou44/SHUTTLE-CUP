/**
 * Générateur Système Suisse.
 * Appariement dynamique selon les scores — pas d'élimination.
 * Byes : les joueurs absents d'une ronde reçoivent +2 pts dans les classements
 * (détection automatique, pas de match BYE créé en DB).
 */

import type { Match } from '@/types/domain'

export interface SwissConfig {
  tournamentId: number
  courtCount: number
}

/**
 * Génère la première ronde suisse.
 * Appariement : moitié haute vs moitié basse (style FIDE).
 * Si nombre de joueurs impair, le dernier ne joue pas ronde 1 (bye silencieux).
 */
export function generateSwissRound1(
  unitIds: number[],
  config: SwissConfig
): Omit<Match, 'id' | 'winnerId' | 'comment'>[] {
  const units = [...unitIds]
  if (units.length % 2 !== 0) units.pop()
  const half = Math.floor(units.length / 2)
  const matches: Omit<Match, 'id' | 'winnerId' | 'comment'>[] = []
  for (let i = 0; i < half; i++) {
    matches.push({
      tournamentId: config.tournamentId,
      round: 1,
      courtNumber: i + 1 <= config.courtCount ? i + 1 : undefined,
      status: 'pending',
      teamA: String(units[i]),
      teamB: String(units[i + half]),
    })
  }
  return matches
}

/**
 * Génère une ronde suisse suivante.
 * Appariement glouton : joueurs de score similaire sont appariés en évitant les revanches.
 * Le joueur restant (nombre impair) reçoit un bye (pas de match créé en DB — géré par les classements).
 *
 * @param unitIds    - Toutes les unités (joueurs ou indices de paires), dans l'ordre de seed initial
 * @param allMatches - Tous les matchs complétés des rondes précédentes
 * @param roundNumber - Numéro de la prochaine ronde
 */
export function generateNextSwissRound(
  unitIds: number[],
  allMatches: Pick<Match, 'teamA' | 'teamB' | 'winnerSide' | 'status'>[],
  roundNumber: number,
  config: SwissConfig
): Omit<Match, 'id' | 'winnerId' | 'comment'>[] {
  // 1. Calcule les points suisses et l'historique des adversaires déjà rencontrés
  const pts = new Map<string, number>(unitIds.map((id) => [String(id), 0]))
  const opponents = new Map<string, Set<string>>(unitIds.map((id) => [String(id), new Set()]))

  for (const m of allMatches) {
    if (m.status !== 'completed' && m.status !== 'walkover') continue
    const a = m.teamA ?? ''
    const b = m.teamB ?? ''
    if (b === 'BYE' || b === '') continue
    opponents.get(a)?.add(b)
    opponents.get(b)?.add(a)
    if (m.winnerSide === 'A') {
      pts.set(a, (pts.get(a) ?? 0) + 2)
      pts.set(b, (pts.get(b) ?? 0) + (m.status === 'walkover' ? 0 : 1))
    } else if (m.winnerSide === 'B') {
      pts.set(b, (pts.get(b) ?? 0) + 2)
      pts.set(a, (pts.get(a) ?? 0) + (m.status === 'walkover' ? 0 : 1))
    }
  }

  // 2. Trie par points décroissants (seed initial comme critère de départage)
  const sorted = unitIds.map(String).sort((a, b) => (pts.get(b) ?? 0) - (pts.get(a) ?? 0))

  // 3. Appariement glouton
  const pool = [...sorted]
  const matches: Omit<Match, 'id' | 'winnerId' | 'comment'>[] = []
  let court = 1

  while (pool.length >= 2) {
    const a = pool.shift()!
    const oppA = opponents.get(a) ?? new Set()
    // Cherche le premier adversaire non encore rencontré
    let idx = pool.findIndex((b) => !oppA.has(b))
    // Accepte la revanche si tous les adversaires disponibles ont déjà été rencontrés
    if (idx === -1) idx = 0
    const b = pool.splice(idx, 1)[0]
    matches.push({
      tournamentId: config.tournamentId,
      round: roundNumber,
      courtNumber: court <= config.courtCount ? court : undefined,
      status: 'pending',
      teamA: a,
      teamB: b,
    })
    court++
  }

  // 4. Bye silencieux : le joueur restant n'a pas de match créé en DB
  // Les classements lui attribuent automatiquement +2 pts (joueur absent d'une ronde)

  return matches
}
