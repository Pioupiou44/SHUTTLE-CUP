// Types de domaine partagés entre les composants React et le layer IPC

export type Gender = 'M' | 'F' | 'X'
export type PlayerStatus = 'active' | 'inactive'
export type TournamentPlayerStatus = 'active' | 'withdrawn' | 'forfeit'
export type TournamentFormat =
  | 'round-robin'
  | 'knockout'
  | 'double-elimination'
  | 'pool+knockout'
  | 'americano'
  | 'swiss'
  | 'king-of-court'
export type TournamentStatus = 'draft' | 'active' | 'completed' | 'archived'
export type MatchStatus = 'pending' | 'in_progress' | 'completed' | 'walkover' | 'postponed'

export interface Player {
  id: number
  firstName: string
  lastName: string
  pseudo?: string
  gender: Gender
  level: string
  status: PlayerStatus
  createdAt: string
}

export interface ScoringRule {
  id: number
  name: string
  setsToWin: number
  pointsPerSet: number
  hasDeuce: boolean
  maxScore: number
  goldenPoint: boolean
  isCustom: boolean
}

export interface Tournament {
  id: number
  name: string
  date: string
  location?: string
  courtCount: number
  logoPath?: string
  format: TournamentFormat
  status: TournamentStatus
  scoringRuleId?: number
  createdAt: string
}

export interface TournamentPlayer {
  id: number
  tournamentId: number
  playerId: number
  seed?: number
  status: TournamentPlayerStatus
  // Jointure avec players
  firstName?: string
  lastName?: string
  pseudo?: string
  gender?: Gender
  level?: string
}

export interface Match {
  id: number
  tournamentId: number
  round?: number
  courtNumber?: number
  scheduledAt?: string
  status: MatchStatus
  winnerId?: number
  comment?: string
  teamA?: string
  teamB?: string
}

export interface MatchScore {
  id: number
  matchId: number
  setNumber: number
  scoreA: number
  scoreB: number
}

// Nom d'affichage d'un joueur (prénom + nom ou pseudo)
export function playerDisplayName(p: Pick<Player, 'firstName' | 'lastName' | 'pseudo'>): string {
  return p.pseudo || `${p.firstName} ${p.lastName}`
}

// Libellé lisible d'un format de tournoi
export const FORMAT_LABELS: Record<TournamentFormat, string> = {
  'round-robin': 'Poules (tout le monde joue contre tout le monde)',
  'knockout': 'Élimination directe (le perdant est éliminé)',
  'double-elimination': 'Double élimination (2 défaites pour être éliminé)',
  'pool+knockout': 'Poules + Élimination (format club recommandé)',
  'americano': 'Américano (partenaires aléatoires à chaque ronde)',
  'swiss': 'Système suisse (rondes fixes, pas d\'élimination)',
  'king-of-court': 'Roi du court (les vainqueurs restent sur le terrain)',
}
