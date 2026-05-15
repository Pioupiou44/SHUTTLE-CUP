import { contextBridge, ipcRenderer } from 'electron'

// Pont IPC typé exposé au renderer via window.db
// Le preload s'exécute en sandbox — pas d'accès Node.js direct
const dbApi = {
  // Joueurs
  getPlayers: () => ipcRenderer.invoke('db:getPlayers'),
  createPlayer: (player: unknown) => ipcRenderer.invoke('db:createPlayer', player),
  updatePlayer: (id: number, data: unknown) => ipcRenderer.invoke('db:updatePlayer', id, data),
  deletePlayer: (id: number) => ipcRenderer.invoke('db:deletePlayer', id),

  // Tournois
  getTournaments: () => ipcRenderer.invoke('db:getTournaments'),
  createTournament: (t: unknown) => ipcRenderer.invoke('db:createTournament', t),
  updateTournament: (id: number, data: unknown) => ipcRenderer.invoke('db:updateTournament', id, data),
  deleteTournament: (id: number) => ipcRenderer.invoke('db:deleteTournament', id),

  // Règles de scoring
  getScoringRules: () => ipcRenderer.invoke('db:getScoringRules'),
  createScoringRule: (rule: unknown) => ipcRenderer.invoke('db:createScoringRule', rule),
  updateScoringRule: (id: number, data: unknown) => ipcRenderer.invoke('db:updateScoringRule', id, data),
  deleteScoringRule: (id: number) => ipcRenderer.invoke('db:deleteScoringRule', id),

  // Joueurs inscrits à un tournoi
  getTournamentPlayers: (tournamentId: number) => ipcRenderer.invoke('db:getTournamentPlayers', tournamentId),
  addPlayerToTournament: (tournamentId: number, playerId: number, seed?: number) =>
    ipcRenderer.invoke('db:addPlayerToTournament', tournamentId, playerId, seed),
  removePlayerFromTournament: (tournamentPlayerId: number) =>
    ipcRenderer.invoke('db:removePlayerFromTournament', tournamentPlayerId),
  setPlayerTeamSide: (tournamentPlayerId: number, side: string | null) =>
    ipcRenderer.invoke('db:setPlayerTeamSide', tournamentPlayerId, side),

  // Matchs
  getMatches: (tournamentId: number) => ipcRenderer.invoke('db:getMatches', tournamentId),
  createMatch: (match: unknown) => ipcRenderer.invoke('db:createMatch', match),
  updateMatchStatus: (matchId: number, status: string, winnerId?: number) =>
    ipcRenderer.invoke('db:updateMatchStatus', matchId, status, winnerId),
  setMatchScore: (matchId: number, setNumber: number, scoreA: number, scoreB: number) =>
    ipcRenderer.invoke('db:setMatchScore', matchId, setNumber, scoreA, scoreB),
  getMatchScores: (matchId: number) => ipcRenderer.invoke('db:getMatchScores', matchId),
  createMatchWithTeams: (match: unknown) => ipcRenderer.invoke('db:createMatchWithTeams', match),
  createPlaceholderMatch: (match: unknown) => ipcRenderer.invoke('db:createPlaceholderMatch', match),
  advanceWinner: (tournamentId: number, completedMatchId: number, winnerPlayerId: number) =>
    ipcRenderer.invoke('db:advanceWinner', tournamentId, completedMatchId, winnerPlayerId),
  seedKnockoutMatches: (seeds: unknown[]) =>
    ipcRenderer.invoke('db:seedKnockoutMatches', seeds),

  // Réorganisation
  swapMatchSides: (matchId1: number, side1: 'A' | 'B', matchId2: number, side2: 'A' | 'B') =>
    ipcRenderer.invoke('db:swapMatchSides', matchId1, side1, matchId2, side2),
  swapMatchPositions: (matchId1: number, matchId2: number) =>
    ipcRenderer.invoke('db:swapMatchPositions', matchId1, matchId2),
  updateMatchCourtNumber: (matchId: number, courtNumber: number | null) =>
    ipcRenderer.invoke('db:updateMatchCourtNumber', matchId, courtNumber),
  getAllMatchScores: (tournamentId: number) => ipcRenderer.invoke('db:getAllMatchScores', tournamentId),
  clearMatchScores: (matchId: number) => ipcRenderer.invoke('db:clearMatchScores', matchId),
  clearTournamentMatches: (tournamentId: number) =>
    ipcRenderer.invoke('db:clearTournamentMatches', tournamentId),

  // Admin / dev
  seedTestPlayers: () => ipcRenderer.invoke('db:seedTestPlayers'),
  clearAllData: () => ipcRenderer.invoke('db:clearAllData'),

  // Fenêtre d'affichage secondaire
  openNewWindow: (hash: string) => ipcRenderer.invoke('open-new-window', hash),
}

contextBridge.exposeInMainWorld('db', dbApi)
