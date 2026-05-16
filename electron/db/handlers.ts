import type { IpcMain } from 'electron'
import { app } from 'electron'
import {
  playerQueries,
  scoringRuleQueries,
  tournamentQueries,
  tournamentPlayerQueries,
  matchQueries,
  adminQueries,
} from './queries'

// ─── Helpers de validation ────────────────────────────────────────────────────

/** Vérifie qu'une valeur est un entier positif (ID de base de données). */
function requireId(value: unknown, name = 'id'): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${name} invalide : ${String(value)}`)
  return n
}

/** Vérifie qu'une valeur appartient à un ensemble de valeurs autorisées. */
function requireEnum<T extends string>(value: unknown, allowed: readonly T[], name = 'valeur'): T {
  if (!allowed.includes(value as T)) throw new Error(`${name} invalide : ${String(value)}`)
  return value as T
}

const VALID_MATCH_STATUSES = ['pending', 'in_progress', 'completed', 'walkover', 'postponed'] as const
const VALID_SIDES = ['A', 'B'] as const

const isDev = !app.isPackaged

export function registerDbHandlers(ipcMain: IpcMain): void {
  // Joueurs
  ipcMain.handle('db:getPlayers', () => playerQueries.getAll())
  ipcMain.handle('db:createPlayer', (_event, player) => playerQueries.create(player))
  ipcMain.handle('db:updatePlayer', (_event, id, data) => playerQueries.update(requireId(id), data))
  ipcMain.handle('db:deletePlayer', (_event, id) => playerQueries.delete(requireId(id)))

  // Règles de scoring
  ipcMain.handle('db:getScoringRules', () => scoringRuleQueries.getAll())
  ipcMain.handle('db:createScoringRule', (_event, rule) => scoringRuleQueries.create(rule))
  ipcMain.handle('db:updateScoringRule', (_event, id, data) => scoringRuleQueries.update(requireId(id), data))
  ipcMain.handle('db:deleteScoringRule', (_event, id) => scoringRuleQueries.delete(requireId(id)))

  // Tournois
  ipcMain.handle('db:getTournaments', () => tournamentQueries.getAll())
  ipcMain.handle('db:createTournament', (_event, t) => tournamentQueries.create(t))
  ipcMain.handle('db:updateTournament', (_event, id, data) => tournamentQueries.update(requireId(id), data))
  ipcMain.handle('db:deleteTournament', (_event, id) => tournamentQueries.delete(requireId(id)))

  // Joueurs inscrits à un tournoi
  ipcMain.handle('db:getTournamentPlayers', (_event, tournamentId) =>
    tournamentPlayerQueries.getAll(requireId(tournamentId, 'tournamentId'))
  )
  ipcMain.handle('db:addPlayerToTournament', (_event, tournamentId, playerId, seed) =>
    tournamentPlayerQueries.add(requireId(tournamentId, 'tournamentId'), requireId(playerId, 'playerId'), seed)
  )
  ipcMain.handle('db:removePlayerFromTournament', (_event, tournamentPlayerId) =>
    tournamentPlayerQueries.remove(requireId(tournamentPlayerId, 'tournamentPlayerId'))
  )
  ipcMain.handle('db:setPlayerTeamSide', (_event, tournamentPlayerId, side) => {
    // side peut être null (retirer l'assignation d'équipe) ou une lettre A-Z
    const validSide = side === null ? null : (() => {
      if (typeof side !== 'string' || !/^[A-Z]$/.test(side)) throw new Error(`teamSide invalide : ${String(side)}`)
      return side
    })()
    return tournamentPlayerQueries.setTeamSide(requireId(tournamentPlayerId, 'tournamentPlayerId'), validSide)
  })

  // Matchs
  ipcMain.handle('db:getMatches', (_event, tournamentId) =>
    matchQueries.getAll(requireId(tournamentId, 'tournamentId'))
  )
  ipcMain.handle('db:createMatch', (_event, match) => matchQueries.create(match))
  ipcMain.handle('db:updateMatchStatus', (_event, matchId, status, winnerId) =>
    matchQueries.updateStatus(
      requireId(matchId, 'matchId'),
      requireEnum(status, VALID_MATCH_STATUSES, 'statut'),
      winnerId != null ? requireId(winnerId, 'winnerId') : undefined,
    )
  )
  ipcMain.handle('db:setMatchScore', (_event, matchId, setNumber, scoreA, scoreB) => {
    const safeA = Number(scoreA)
    const safeB = Number(scoreB)
    if (!Number.isInteger(safeA) || safeA < 0 || safeA > 999) throw new Error(`scoreA invalide : ${String(scoreA)}`)
    if (!Number.isInteger(safeB) || safeB < 0 || safeB > 999) throw new Error(`scoreB invalide : ${String(scoreB)}`)
    return matchQueries.setScore(requireId(matchId, 'matchId'), Number(setNumber), safeA, safeB)
  })
  ipcMain.handle('db:getMatchScores', (_event, matchId) => matchQueries.getScores(requireId(matchId, 'matchId')))
  ipcMain.handle('db:getAllMatchScores', (_event, tournamentId) =>
    matchQueries.getAllScores(requireId(tournamentId, 'tournamentId'))
  )
  ipcMain.handle('db:clearMatchScores', (_event, matchId) => matchQueries.clearMatchScores(requireId(matchId, 'matchId')))
  ipcMain.handle('db:createMatchWithTeams', (_event, match) => matchQueries.createWithTeams(match))
  ipcMain.handle('db:createPlaceholderMatch', (_event, match) => matchQueries.createPlaceholder(match))
  ipcMain.handle('db:advanceWinner', (_event, tournamentId, completedMatchId, winnerPlayerId) =>
    matchQueries.advanceWinner(
      requireId(tournamentId, 'tournamentId'),
      requireId(completedMatchId, 'completedMatchId'),
      requireId(winnerPlayerId, 'winnerPlayerId'),
    )
  )
  ipcMain.handle('db:seedKnockoutMatches', (_event, seeds) => {
    if (!Array.isArray(seeds)) throw new Error('seeds doit être un tableau')
    return matchQueries.seedKnockoutMatches(seeds)
  })

  // Gestion du planning / terrains
  ipcMain.handle('db:swapMatchSides', (_event, matchId1, side1, matchId2, side2) =>
    matchQueries.swapMatchSides(
      requireId(matchId1, 'matchId1'),
      requireEnum(side1, VALID_SIDES, 'side1'),
      requireId(matchId2, 'matchId2'),
      requireEnum(side2, VALID_SIDES, 'side2'),
    )
  )
  ipcMain.handle('db:swapMatchPositions', (_event, matchId1, matchId2) =>
    matchQueries.swapMatchPositions(requireId(matchId1, 'matchId1'), requireId(matchId2, 'matchId2'))
  )
  ipcMain.handle('db:updateMatchCourtNumber', (_event, matchId, courtNumber) =>
    matchQueries.updateMatchCourtNumber(requireId(matchId, 'matchId'), courtNumber)
  )
  ipcMain.handle('db:clearTournamentMatches', (_event, tournamentId) =>
    matchQueries.clearForTournament(requireId(tournamentId, 'tournamentId'))
  )

  // Outils admin/dev — désactivés en production
  if (isDev) {
    ipcMain.handle('db:seedTestPlayers', () => adminQueries.seedTestPlayers())
    ipcMain.handle('db:clearAllData', () => adminQueries.clearAllData())
  }
}
