// Types de domaine partagés entre les composants React et le layer IPC

export type Gender = 'M' | 'F' | 'X'
export type PlayerStatus = 'active' | 'inactive'
export type TournamentPlayerStatus = 'active' | 'withdrawn' | 'forfeit'
export type MatchCategory = 'SH' | 'SD' | 'DH' | 'DD' | 'DX'
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
  club?: string
  elo?: number
  playerNumber?: number
  status: PlayerStatus
  createdAt: string
  /** Nombre de tournois joués — calculé côté DB via JOIN */
  tournamentCount?: number
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
  categories: MatchCategory[]
  /** 0 = tournoi individuel, 1 = rencontre par équipes (interclub) */
  teamMode: number
  teamAName?: string
  teamBName?: string
  /** Noms des équipes [idx] → lettre 'A'+idx (ex : ['Club Vertou', 'Club Saint-Mars', 'Club Nantes']) */
  teamNames?: string[]
  createdAt: string
}

export interface TournamentPlayer {
  id: number
  tournamentId: number
  playerId: number
  seed?: number
  status: TournamentPlayerStatus
  teamSide?: string  // 'A' | 'B' — mode équipes uniquement
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
  winnerSide?: 'A' | 'B'
  comment?: string
  teamA?: string
  teamB?: string
  category?: MatchCategory
}

export interface MatchScore {
  id: number
  matchId: number
  setNumber: number
  scoreA: number
  scoreB: number
}

// Nom d'affichage d'un joueur (prénom + NOM en majuscules, ou pseudo)
export function playerDisplayName(p: Pick<Player, 'firstName' | 'lastName' | 'pseudo'>): string {
  if (p.pseudo) return p.pseudo
  return `${p.firstName} ${p.lastName.toUpperCase()}`
}

// Libellés lisibles des catégories de match
export const CATEGORY_LABELS: Record<MatchCategory, string> = {
  SH: 'Simple Hommes',
  SD: 'Simple Dames',
  DH: 'Double Hommes',
  DD: 'Double Dames',
  DX: 'Double Mixte',
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
