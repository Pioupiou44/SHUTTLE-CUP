/**
 * Moteur de scoring — logique pure, sans React, sans état global.
 * Toutes les fonctions sont déterministes et testables via Vitest.
 */

import type { ScoringRule, MatchScore } from '@/types/domain'

export interface SetResult {
  scoreA: number
  scoreB: number
  winner: 'A' | 'B' | null // null = set en cours
}

export interface MatchResult {
  setsA: number
  setsB: number
  sets: SetResult[]
  winner: 'A' | 'B' | null
  isComplete: boolean
}

/**
 * Vérifie si un score de set est valide (le set est terminé).
 * Gère la déuce et le golden point.
 */
export function isSetComplete(
  scoreA: number,
  scoreB: number,
  rule: Pick<ScoringRule, 'pointsPerSet' | 'hasDeuce' | 'maxScore'>
): boolean {
  const target = rule.pointsPerSet

  if (!rule.hasDeuce) {
    // Pas de déuce : le premier à `target` gagne, peu importe l'écart
    return scoreA >= target || scoreB >= target
  }

  // Avec déuce : il faut 2 points d'écart minimum
  if (scoreA >= target || scoreB >= target) {
    const diff = Math.abs(scoreA - scoreB)
    if (diff >= 2) return true
    // Vérification golden point (maxScore)
    if (rule.maxScore > 0) {
      return scoreA >= rule.maxScore || scoreB >= rule.maxScore
    }
  }
  return false
}

/**
 * Retourne le gagnant d'un set terminé, ou null si le set n'est pas terminé.
 */
export function getSetWinner(
  scoreA: number,
  scoreB: number,
  rule: Pick<ScoringRule, 'pointsPerSet' | 'hasDeuce' | 'maxScore'>
): 'A' | 'B' | null {
  if (!isSetComplete(scoreA, scoreB, rule)) return null
  return scoreA > scoreB ? 'A' : 'B'
}

/**
 * Calcule le résultat complet d'un match à partir des scores de sets.
 */
export function computeMatchResult(scores: MatchScore[], rule: ScoringRule): MatchResult {
  const sets: SetResult[] = scores.map((s) => ({
    scoreA: s.scoreA,
    scoreB: s.scoreB,
    winner: getSetWinner(s.scoreA, s.scoreB, rule),
  }))

  const setsA = sets.filter((s) => s.winner === 'A').length
  const setsB = sets.filter((s) => s.winner === 'B').length
  const isComplete = setsA >= rule.setsToWin || setsB >= rule.setsToWin

  return {
    setsA,
    setsB,
    sets,
    winner: isComplete ? (setsA > setsB ? 'A' : 'B') : null,
    isComplete,
  }
}

/**
 * Retourne le numéro du set courant (1-based) en cours de jeu.
 * Retourne null si le match est terminé.
 */
export function getCurrentSet(scores: MatchScore[], rule: ScoringRule): number | null {
  const result = computeMatchResult(scores, rule)
  if (result.isComplete) return null

  // Cherche un set en cours (non terminé)
  for (let i = 0; i < scores.length; i++) {
    if (result.sets[i]?.winner === null) return i + 1
  }
  // Tous les sets existants sont terminés → nouveau set
  return scores.length + 1
}

/**
 * Calcule le score affiché dans le Ticker : "A 2-1 B (21-18 19-21 15-12)".
 */
export function formatMatchScore(result: MatchResult): string {
  const setScores = result.sets
    .map((s) => `${s.scoreA}-${s.scoreB}`)
    .join(' ')
  return `${result.setsA}-${result.setsB} (${setScores})`
}
