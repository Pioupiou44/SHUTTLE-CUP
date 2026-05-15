import type { IpcMain } from 'electron'
import {
  playerQueries,
  scoringRuleQueries,
  tournamentQueries,
  tournamentPlayerQueries,
  matchQueries,
  adminQueries,
} from './queries'

export function registerDbHandlers(ipcMain: IpcMain): void {
  // Joueurs
  ipcMain.handle('db:getPlayers', () => playerQueries.getAll())
  ipcMain.handle('db:createPlayer', (_event, player) => playerQueries.create(player))
  ipcMain.handle('db:updatePlayer', (_event, id, data) => playerQueries.update(id, data))
  ipcMain.handle('db:deletePlayer', (_event, id) => playerQueries.delete(id))

  // Règles de scoring
  ipcMain.handle('db:getScoringRules', () => scoringRuleQueries.getAll())
  ipcMain.handle('db:createScoringRule', (_event, rule) => scoringRuleQueries.create(rule))
  ipcMain.handle('db:updateScoringRule', (_event, id, data) => scoringRuleQueries.update(id, data))
  ipcMain.handle('db:deleteScoringRule', (_event, id) => scoringRuleQueries.delete(id))

  // Tournois
  ipcMain.handle('db:getTournaments', () => tournamentQueries.getAll())
  ipcMain.handle('db:createTournament', (_event, t) => tournamentQueries.create(t))
  ipcMain.handle('db:updateTournament', (_event, id, data) => tournamentQueries.update(id, data))
  ipcMain.handle('db:deleteTournament', (_event, id) => tournamentQueries.delete(id))

  // Joueurs inscrits à un tournoi
  ipcMain.handle('db:getTournamentPlayers', (_event, tournamentId) =>
    tournamentPlayerQueries.getAll(tournamentId)
  )
  ipcMain.handle('db:addPlayerToTournament', (_event, tournamentId, playerId, seed) =>
    tournamentPlayerQueries.add(tournamentId, playerId, seed)
  )
  ipcMain.handle('db:removePlayerFromTournament', (_event, tournamentPlayerId) =>
    tournamentPlayerQueries.remove(tournamentPlayerId)
  )
  ipcMain.handle('db:setPlayerTeamSide', (_event, tournamentPlayerId, side) =>
    tournamentPlayerQueries.setTeamSide(tournamentPlayerId, side)
  )

  // Matchs
  ipcMain.handle('db:getMatches', (_event, tournamentId) => matchQueries.getAll(tournamentId))
  ipcMain.handle('db:createMatch', (_event, match) => matchQueries.create(match))
  ipcMain.handle('db:updateMatchStatus', (_event, matchId, status, winnerId) =>
    matchQueries.updateStatus(matchId, status, winnerId)
  )
  ipcMain.handle('db:setMatchScore', (_event, matchId, setNumber, scoreA, scoreB) =>
    matchQueries.setScore(matchId, setNumber, scoreA, scoreB)
  )
  ipcMain.handle('db:getMatchScores', (_event, matchId) => matchQueries.getScores(matchId))
  ipcMain.handle('db:getAllMatchScores', (_event, tournamentId) => matchQueries.getAllScores(tournamentId))
  ipcMain.handle('db:clearMatchScores', (_event, matchId) => matchQueries.clearMatchScores(matchId))
  ipcMain.handle('db:createMatchWithTeams', (_event, match) => matchQueries.createWithTeams(match))
  ipcMain.handle('db:createPlaceholderMatch', (_event, match) => matchQueries.createPlaceholder(match))
  ipcMain.handle('db:advanceWinner', (_event, tournamentId, completedMatchId, winnerPlayerId) =>
    matchQueries.advanceWinner(tournamentId, completedMatchId, winnerPlayerId)
  )
  ipcMain.handle('db:seedKnockoutMatches', (_event, seeds) =>
    matchQueries.seedKnockoutMatches(seeds)
  )

  // Admin / dev
  ipcMain.handle('db:swapMatchSides', (_event, matchId1, side1, matchId2, side2) =>
    matchQueries.swapMatchSides(matchId1, side1, matchId2, side2)
  )
  ipcMain.handle('db:swapMatchPositions', (_event, matchId1, matchId2) =>
    matchQueries.swapMatchPositions(matchId1, matchId2)
  )
  ipcMain.handle('db:updateMatchCourtNumber', (_event, matchId, courtNumber) =>
    matchQueries.updateMatchCourtNumber(matchId, courtNumber)
  )
  ipcMain.handle('db:clearTournamentMatches', (_event, tournamentId) =>
    matchQueries.clearForTournament(tournamentId)
  )
  ipcMain.handle('db:seedTestPlayers', () => adminQueries.seedTestPlayers())
  ipcMain.handle('db:clearAllData', () => adminQueries.clearAllData())
}
