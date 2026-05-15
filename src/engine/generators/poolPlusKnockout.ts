/**
 * Générateur Poules + Élimination directe (Pool + Knockout).
 * Phase 1 : Round Robin intra-groupe.
 * Phase 2 : les N premiers de chaque groupe avancent en bracket.
 *
 * Les matchs de la phase knockout sont créés en placeholder (no teams)
 * et remplis automatiquement après la phase de groupes.
 */

import type { Match } from '@/types/domain'
import { generateRoundRobin } from './roundRobin'
import { nextPowerOf2 } from './singleElim'

export interface PoolKnockoutConfig {
  tournamentId: number
  courtCount: number
  /** Nombre de groupes (poules) — défaut : 2 */
  poolCount: number
  /** Nombre de qualifiés par groupe — défaut : 2 */
  qualifiersPerPool?: number
  /** Assignation manuelle des joueurs aux groupes (fourni par le wizard si personnalisé) */
  manualPools?: number[][]
}

export interface PoolKnockoutResult {
  /** Matchs de la phase de groupes (générés immédiatement) */
  poolMatches: Omit<Match, 'id' | 'winnerId'>[]
  /** Matchs placeholder de la phase knockout (remplis après groupes) */
  knockoutMatches: Omit<Match, 'id' | 'winnerId'>[]
  /** Attribution joueurs → groupe */
  pools: number[][]
}

/**
 * Répartit les joueurs en groupes de taille équilibrée par seed.
 * Serpentin : joueur 1 → groupe 1, joueur 2 → groupe 2, …, joueur N → groupe 1 (retour)
 */
export function splitIntoPools(playerIds: number[], poolCount: number): number[][] {
  const pools: number[][] = Array.from({ length: poolCount }, () => [])
  playerIds.forEach((id, i) => {
    const poolIdx = i % poolCount
    pools[poolIdx].push(id)
  })
  return pools
}

/**
 * Génère l'ensemble des matchs pour un tournoi Poules + Élimination.
 */
export function generatePoolPlusKnockout(
  playerIds: number[],
  config: PoolKnockoutConfig
): PoolKnockoutResult {
  const poolCount = Math.max(2, config.poolCount)
  const qualifiers = config.qualifiersPerPool ?? 2

  // Utilise l'assignation manuelle (wizard) si fournie et cohérente, sinon serpentin automatique
  const pools = (config.manualPools && config.manualPools.length === poolCount)
    ? config.manualPools
    : splitIntoPools(playerIds, poolCount)

  // Limite les qualifiants par poule à la taille de la plus petite poule moins 1
  // (on ne peut qualifier davantage que les participants d'une poule)
  const minPoolSize = pools.length > 0 ? Math.min(...pools.map((p) => p.length)) : 2
  const effectiveQualifiers = Math.min(qualifiers, Math.max(1, minPoolSize - 1))

  // Phase 1 : Round Robin par groupe
  // Chaque poule reçoit un décalage de terrain pour éviter que toutes les poules
  // commencent au terrain 1. La poule i commence au terrain (somme des terrains des poules précédentes + 1).
  const poolMatches: Omit<Match, 'id' | 'winnerId'>[] = []
  let courtBase = 1
  for (let poolIdx = 0; poolIdx < pools.length; poolIdx++) {
    const poolPlayers = pools[poolIdx]
    const courtsForPool = Math.max(1, Math.floor(poolPlayers.length / 2))
    const rrMatches = generateRoundRobin(poolPlayers, {
      tournamentId: config.tournamentId,
      courtCount: courtsForPool,
    }).map((m) => {
      // Modulo cyclique : les terrains ne dépassent jamais courtCount
      const adjustedCourt = m.courtNumber != null
        ? ((m.courtNumber + courtBase - 2) % config.courtCount) + 1
        : undefined
      return {
        ...m,
        courtNumber: adjustedCourt,
        comment: `Groupe ${String.fromCharCode(65 + poolIdx)}`, // A, B, C…
      }
    })
    poolMatches.push(...rrMatches)
    courtBase += courtsForPool
  }

  // Phase 2 : Bracket knockout (qualifiés × poolCount joueurs)
  const knockoutSize = nextPowerOf2(effectiveQualifiers * poolCount)
  const knockoutRoundsCount = Math.log2(knockoutSize)
  const knockoutMatches: Omit<Match, 'id' | 'winnerId'>[] = []

  // Round 1 du knockout (slots à remplir après groupes)
  for (let i = 0; i < knockoutSize / 2; i++) {
    knockoutMatches.push({
      tournamentId: config.tournamentId,
      round: 100 + 1, // Round 100+ = phase knockout (distingué de la phase de groupes)
      status: 'pending',
      comment: 'Knockout',
      teamA: undefined,
      teamB: undefined,
    })
  }

  // Rounds suivants du knockout
  let matchesInRound = knockoutSize / 4
  for (let round = 2; round <= knockoutRoundsCount; round++) {
    for (let i = 0; i < matchesInRound; i++) {
      knockoutMatches.push({
        tournamentId: config.tournamentId,
        round: 100 + round,
        status: 'pending',
        comment: round === knockoutRoundsCount ? 'Finale' : `Knockout R${round}`,
        teamA: undefined,
        teamB: undefined,
      })
    }
    matchesInRound = Math.max(1, matchesInRound / 2)
  }

  return { poolMatches, knockoutMatches, pools }
}

/**
 * Estime le nombre total de matchs pour le format Poules + Knockout.
 */
export function countPoolKnockoutMatches(
  playerCount: number,
  poolCount: number,
  qualifiersPerPool = 2
): number {
  const pools = splitIntoPools(
    Array.from({ length: playerCount }, (_, i) => i),
    poolCount
  )
  const poolMatchCount = pools.reduce(
    (acc, pool) => acc + (pool.length * (pool.length - 1)) / 2,
    0
  )
  const knockoutPlayers = qualifiersPerPool * poolCount
  const knockoutMatches = nextPowerOf2(knockoutPlayers) - 1
  return poolMatchCount + knockoutMatches
}
