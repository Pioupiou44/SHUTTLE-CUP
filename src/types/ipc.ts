import type {
  Player,
  ScoringRule,
  Tournament,
  TournamentPlayer,
  Match,
  MatchScore,
  MatchCategory,
} from './domain'

// Interface typée du pont IPC exposé via contextBridge
export interface DbApi {
  // Joueurs
  getPlayers: () => Promise<Player[]>
  createPlayer: (player: Omit<Player, 'id' | 'createdAt'>) => Promise<Player>
  updatePlayer: (id: number, data: Partial<Omit<Player, 'id' | 'createdAt'>>) => Promise<Player>
  deletePlayer: (id: number) => Promise<void>

  // Tournois
  getTournaments: () => Promise<Tournament[]>
  createTournament: (t: Omit<Tournament, 'id' | 'createdAt'>) => Promise<Tournament>
  updateTournament: (id: number, data: Partial<Omit<Tournament, 'id' | 'createdAt'>>) => Promise<Tournament>
  deleteTournament: (id: number) => Promise<void>

  // Règles de scoring
  getScoringRules: () => Promise<ScoringRule[]>
  createScoringRule: (rule: Omit<ScoringRule, 'id' | 'isCustom'>) => Promise<ScoringRule>
  updateScoringRule: (id: number, data: Partial<Omit<ScoringRule, 'id' | 'isCustom'>>) => Promise<ScoringRule>
  deleteScoringRule: (id: number) => Promise<void>

  // Joueurs d'un tournoi
  getTournamentPlayers: (tournamentId: number) => Promise<TournamentPlayer[]>
  addPlayerToTournament: (tournamentId: number, playerId: number, seed?: number) => Promise<TournamentPlayer>
  removePlayerFromTournament: (tournamentPlayerId: number) => Promise<void>

  // Matchs
  getMatches: (tournamentId: number) => Promise<Match[]>
  createMatch: (match: { tournamentId: number; round?: number; courtNumber?: number; playerAId: number; playerBId: number; category?: MatchCategory }) => Promise<Match>
  updateMatchStatus: (matchId: number, status: string, winnerId?: number) => Promise<void>
  setMatchScore: (matchId: number, setNumber: number, scoreA: number, scoreB: number) => Promise<void>
  getMatchScores: (matchId: number) => Promise<MatchScore[]>
  createPlaceholderMatch: (match: { tournamentId: number; round?: number; courtNumber?: number; comment?: string; category?: MatchCategory }) => Promise<Match>
  advanceWinner: (tournamentId: number, completedMatchId: number, winnerPlayerId: number) => Promise<void>

  // Admin / dev
  clearAllData: () => Promise<void>
}

// Déclaration globale pour TypeScript — window.db est disponible après preload
declare global {
  interface Window {
    db: DbApi
  }
}
