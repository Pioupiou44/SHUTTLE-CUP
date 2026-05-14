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

  // Matchs
  getMatches: (tournamentId: number) => ipcRenderer.invoke('db:getMatches', tournamentId),
  updateMatchStatus: (matchId: number, status: string, winnerId?: number) =>
    ipcRenderer.invoke('db:updateMatchStatus', matchId, status, winnerId),
  setMatchScore: (matchId: number, setNumber: number, scoreA: number, scoreB: number) =>
    ipcRenderer.invoke('db:setMatchScore', matchId, setNumber, scoreA, scoreB),
}

contextBridge.exposeInMainWorld('db', dbApi)
