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
  setPlayerTeamSide: (tournamentPlayerId: number, side: string | null) => Promise<void>

  // Matchs
  getMatches: (tournamentId: number) => Promise<Match[]>
  createMatch: (match: { tournamentId: number; round?: number; courtNumber?: number; playerAId: number; playerBId: number; category?: MatchCategory; comment?: string }) => Promise<Match>
  updateMatchStatus: (matchId: number, status: string, winnerId?: number) => Promise<void>
  setMatchScore: (matchId: number, setNumber: number, scoreA: number, scoreB: number) => Promise<void>
  getMatchScores: (matchId: number) => Promise<MatchScore[]>
  getAllMatchScores: (tournamentId: number) => Promise<MatchScore[]>
  clearMatchScores: (matchId: number) => Promise<void>
  createMatchWithTeams: (match: { tournamentId: number; round?: number; courtNumber?: number; teamAPlayerIds: number[]; teamBPlayerIds: number[]; category?: MatchCategory; comment?: string }) => Promise<Match>
  createPlaceholderMatch: (match: { tournamentId: number; round?: number; courtNumber?: number; comment?: string; category?: MatchCategory }) => Promise<Match>
  advanceWinner: (tournamentId: number, completedMatchId: number, winnerPlayerId: number) => Promise<void>
  seedKnockoutMatches: (seeds: { matchId: number; side: 'A' | 'B'; playerIds: number[]; tournamentId: number }[]) => Promise<void>

  // Réorganisation des matchs
  swapMatchSides: (matchId1: number, side1: 'A' | 'B', matchId2: number, side2: 'A' | 'B') => Promise<void>
  swapMatchPositions: (matchId1: number, matchId2: number) => Promise<void>
  updateMatchCourtNumber: (matchId: number, courtNumber: number | null) => Promise<void>
  clearTournamentMatches: (tournamentId: number) => Promise<void>

  // Admin / dev
  seedTestPlayers: () => Promise<void>
  clearAllData: () => Promise<void>
}

// Déclaration globale pour TypeScript — window.db est disponible après preload
declare global {
  interface Window {
    db: DbApi
  }
}
