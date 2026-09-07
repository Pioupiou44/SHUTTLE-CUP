// Adaptateur Capacitor (Android) — implémente l'interface DbApi
// (src/types/ipc.ts) avec le plugin @capacitor-community/sqlite.
// Mêmes signatures, mêmes données de retour que le preload Electron :
// les stores Zustand et les pages React fonctionnent sans modification.
//
// Différences avec Electron :
// - `openNewWindow` est un no-op (Android n'a pas de multi-fenêtres WebView)
// - SQL adapté au SQLite natif Android : pas de NULLS LAST (min API 30),
//   pas d'UPSERT ON CONFLICT (min API 29) → équivalents portables.

import type { DbApi } from '@/types/ipc'
import { query, queryOne, run } from './sqlite-capacitor'
import type {
  Player,
  ScoringRule,
  Tournament,
  TournamentPlayer,
  Match,
  MatchScore,
} from '@/types/domain'

// ─── Helpers ──────────────────────────────────────────────────────────────

// Convertit les entiers SQLite 0/1 en booléens pour le renderer (parité avec queries.ts)
function boolifyRule(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    hasDeuce: row.hasDeuce === 1,
    goldenPoint: row.goldenPoint === 1,
    isCustom: row.isCustom === 1,
  }
}

// Parse les colonnes JSON des tournois (categories, teamNames) + valeur par défaut poolCount
function parseTournament(row: Record<string, unknown>): Record<string, unknown> {
  let categories: string[] = []
  try { categories = JSON.parse((row.categories as string | null) ?? '[]') } catch { /* vide */ }
  let teamNames: string[] | undefined
  if (row.teamNames) {
    try { teamNames = JSON.parse(row.teamNames as string) } catch { /* vide */ }
  }
  return { ...row, categories, teamNames, poolCount: (row.poolCount as number | null) ?? 2 }
}

/** Clause SET dynamique — même logique que queries.ts (champs autorisés uniquement). */
function buildUpdate(
  data: Record<string, unknown>,
  allowed: string[],
  transform: (field: string, value: unknown) => unknown = (_f, v) => v
): { setClause: string; values: unknown[] } {
  const fields = Object.keys(data).filter((k) => allowed.includes(k))
  const setClause = fields.map((f) => `${f} = ?`).join(', ')
  const values = fields.map((f) => transform(f, data[f]))
  return { setClause, values }
}

// ─── Adaptateur ───────────────────────────────────────────────────────────

export const capacitorDbAdapter: DbApi = {
  // ── Joueurs ──
  async getPlayers(): Promise<Player[]> {
    // NULLS LAST non supporté avant Android 11 (SQLite 3.30) → tri elo NULL en premier,
    // on inverse : d'abord les non-NULL par elo DESC, puis les NULL par nom.
    return query<Player>(`
      SELECT p.*, COUNT(DISTINCT tp.tournamentId) AS tournamentCount
      FROM players p
      LEFT JOIN tournament_players tp ON tp.playerId = p.id
      GROUP BY p.id
      ORDER BY p.elo IS NULL, p.elo DESC, p.lastName, p.firstName
    `)
  },

  async createPlayer(player: Omit<Player, 'id' | 'createdAt'>): Promise<Player> {
    const result = await run(
      'INSERT INTO players (firstName, lastName, pseudo, gender, level, club, elo, playerNumber, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        player.firstName, player.lastName, player.pseudo ?? null, player.gender, player.level,
        player.club ?? null, player.elo ?? 1000, player.playerNumber ?? null, player.status ?? 'active',
      ]
    )
    return queryOne<Player>(
      `SELECT p.*, COUNT(DISTINCT tp.tournamentId) AS tournamentCount
       FROM players p LEFT JOIN tournament_players tp ON tp.playerId = p.id
       WHERE p.id = ? GROUP BY p.id`,
      [result.lastId]
    ) as Promise<Player>
  },

  async updatePlayer(id: number, data: Partial<Omit<Player, 'id' | 'createdAt'>>): Promise<Player> {
    const allowed = ['firstName', 'lastName', 'pseudo', 'gender', 'level', 'club', 'elo', 'playerNumber', 'status']
    const { setClause, values } = buildUpdate(data as Record<string, unknown>, allowed)
    if (setClause) {
      await run(`UPDATE players SET ${setClause} WHERE id = ?`, [...values, id])
    }
    return queryOne<Player>(
      `SELECT p.*, COUNT(DISTINCT tp.tournamentId) AS tournamentCount
       FROM players p LEFT JOIN tournament_players tp ON tp.playerId = p.id
       WHERE p.id = ? GROUP BY p.id`,
      [id]
    ) as Promise<Player>
  },

  async deletePlayer(id: number): Promise<void> {
    await run('DELETE FROM players WHERE id = ?', [id])
  },

  // ── Règles de scoring ──
  async getScoringRules(): Promise<ScoringRule[]> {
    const rows = await query<Record<string, unknown>>(
      'SELECT * FROM scoring_rules ORDER BY isCustom, id'
    )
    return rows.map((r) => boolifyRule(r)) as unknown as ScoringRule[]
  },

  async createScoringRule(rule: Omit<ScoringRule, 'id' | 'isCustom'>): Promise<ScoringRule> {
    const result = await run(
      'INSERT INTO scoring_rules (name, setsToWin, pointsPerSet, hasDeuce, maxScore, goldenPoint, isCustom) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [
        rule.name, rule.setsToWin, rule.pointsPerSet,
        rule.hasDeuce ? 1 : 0, rule.maxScore, rule.goldenPoint ? 1 : 0,
      ]
    )
    const row = await queryOne<Record<string, unknown>>('SELECT * FROM scoring_rules WHERE id = ?', [result.lastId])
    return boolifyRule(row!) as unknown as ScoringRule
  },

  async updateScoringRule(id: number, data: Partial<Omit<ScoringRule, 'id' | 'isCustom'>>): Promise<ScoringRule> {
    const allowed = ['name', 'setsToWin', 'pointsPerSet', 'hasDeuce', 'maxScore', 'goldenPoint']
    const { setClause, values } = buildUpdate(data as Record<string, unknown>, allowed, (f, v) =>
      f === 'hasDeuce' || f === 'goldenPoint' ? (v ? 1 : 0) : v
    )
    if (setClause) {
      await run(`UPDATE scoring_rules SET ${setClause} WHERE id = ?`, [...values, id])
    }
    const row = await queryOne<Record<string, unknown>>('SELECT * FROM scoring_rules WHERE id = ?', [id])
    return boolifyRule(row!) as unknown as ScoringRule
  },

  async deleteScoringRule(id: number): Promise<void> {
    await run('DELETE FROM scoring_rules WHERE id = ? AND isCustom = 1', [id])
  },

  // ── Tournois ──
  async getTournaments(): Promise<Tournament[]> {
    const rows = await query<Record<string, unknown>>(
      'SELECT * FROM tournaments ORDER BY date DESC'
    )
    return rows.map((r) => parseTournament(r)) as unknown as Tournament[]
  },

  async createTournament(t: Omit<Tournament, 'id' | 'createdAt'>): Promise<Tournament> {
    const result = await run(
      'INSERT INTO tournaments (name, date, location, courtCount, poolCount, logoPath, format, scoringRuleId, categories, teamMode, teamAName, teamBName, teamNames) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        t.name, t.date, t.location ?? null, t.courtCount ?? 4, t.poolCount ?? 2,
        t.logoPath ?? null, t.format, t.scoringRuleId ?? null,
        JSON.stringify(t.categories ?? []), t.teamMode ?? 0,
        t.teamAName ?? null, t.teamBName ?? null,
        t.teamNames ? JSON.stringify(t.teamNames) : null,
      ]
    )
    const row = await queryOne<Record<string, unknown>>('SELECT * FROM tournaments WHERE id = ?', [result.lastId])
    return parseTournament(row!) as unknown as Tournament
  },

  async updateTournament(id: number, data: Partial<Omit<Tournament, 'id' | 'createdAt'>>): Promise<Tournament> {
    const allowed = ['name', 'date', 'location', 'courtCount', 'poolCount', 'logoPath', 'format', 'status', 'scoringRuleId', 'categories', 'teamMode', 'teamAName', 'teamBName', 'teamNames']
    const { setClause, values } = buildUpdate(data as Record<string, unknown>, allowed, (f, v) =>
      f === 'categories' || f === 'teamNames' ? JSON.stringify(v) : v
    )
    if (setClause) {
      await run(`UPDATE tournaments SET ${setClause} WHERE id = ?`, [...values, id])
    }
    const row = await queryOne<Record<string, unknown>>('SELECT * FROM tournaments WHERE id = ?', [id])
    return parseTournament(row!) as unknown as Tournament
  },

  async deleteTournament(id: number): Promise<void> {
    await run('DELETE FROM tournaments WHERE id = ?', [id])
  },

  // ── Joueurs inscrits à un tournoi ──
  async getTournamentPlayers(tournamentId: number): Promise<TournamentPlayer[]> {
    return query<TournamentPlayer>(`
      SELECT tp.*, p.firstName, p.lastName, p.pseudo, p.gender, p.level
      FROM tournament_players tp
      JOIN players p ON p.id = tp.playerId
      WHERE tp.tournamentId = ?
      ORDER BY tp.seed, p.lastName
    `, [tournamentId])
  },

  async addPlayerToTournament(tournamentId: number, playerId: number, seed?: number): Promise<TournamentPlayer> {
    const result = await run(
      'INSERT INTO tournament_players (tournamentId, playerId, seed) VALUES (?, ?, ?)',
      [tournamentId, playerId, seed ?? null]
    )
    return queryOne<TournamentPlayer>('SELECT * FROM tournament_players WHERE id = ?', [result.lastId]) as Promise<TournamentPlayer>
  },

  async removePlayerFromTournament(tournamentPlayerId: number): Promise<void> {
    await run('DELETE FROM tournament_players WHERE id = ?', [tournamentPlayerId])
  },

  async setPlayerTeamSide(tournamentPlayerId: number, side: string | null): Promise<void> {
    await run('UPDATE tournament_players SET teamSide = ? WHERE id = ?', [side, tournamentPlayerId])
  },

  // ── Matchs ──
  async getMatches(tournamentId: number): Promise<Match[]> {
    // Retourne les IDs joueurs dans teamA/teamB pour que l'engine puisse les identifier
    return query<Match>(`
      SELECT m.*,
        GROUP_CONCAT(CASE WHEN mp.side='A' THEN CAST(p.id AS TEXT) END) as teamA,
        GROUP_CONCAT(CASE WHEN mp.side='B' THEN CAST(p.id AS TEXT) END) as teamB,
        CASE
          WHEN m.winnerId IS NULL THEN NULL
          WHEN EXISTS (SELECT 1 FROM match_participants mp2 WHERE mp2.matchId = m.id AND mp2.side = 'A' AND mp2.tournamentPlayerId = m.winnerId) THEN 'A'
          ELSE 'B'
        END as winnerSide
      FROM matches m
      LEFT JOIN match_participants mp ON mp.matchId = m.id
      LEFT JOIN tournament_players tp ON tp.id = mp.tournamentPlayerId
      LEFT JOIN players p ON p.id = tp.playerId
      WHERE m.tournamentId = ?
      GROUP BY m.id
      ORDER BY m.round, m.id
    `, [tournamentId])
  },

  async createMatch(match: { tournamentId: number; round?: number; courtNumber?: number; playerAId: number; playerBId: number; category?: Match['category']; comment?: string }): Promise<Match> {
    const mResult = await run(
      'INSERT INTO matches (tournamentId, round, courtNumber, status, category, comment) VALUES (?, ?, ?, ?, ?, ?)',
      [match.tournamentId, match.round ?? null, match.courtNumber ?? null, 'pending', match.category ?? null, match.comment ?? null]
    )
    const matchId = mResult.lastId

    // Retrouve les tournament_player IDs des deux joueurs
    const tpA = await queryOne<{ id: number }>(
      'SELECT id FROM tournament_players WHERE tournamentId = ? AND playerId = ?',
      [match.tournamentId, match.playerAId]
    )
    const tpB = await queryOne<{ id: number }>(
      'SELECT id FROM tournament_players WHERE tournamentId = ? AND playerId = ?',
      [match.tournamentId, match.playerBId]
    )

    if (tpA && tpB) {
      await run('INSERT INTO match_participants (matchId, side, tournamentPlayerId) VALUES (?, ?, ?)', [matchId, 'A', tpA.id])
      await run('INSERT INTO match_participants (matchId, side, tournamentPlayerId) VALUES (?, ?, ?)', [matchId, 'B', tpB.id])
    }

    return queryOne<Match>('SELECT * FROM matches WHERE id = ?', [matchId]) as Promise<Match>
  },

  async updateMatchStatus(matchId: number, status: string, winnerId?: number): Promise<void> {
    await run('UPDATE matches SET status = ?, winnerId = ? WHERE id = ?', [status, winnerId ?? null, matchId])
  },

  async setMatchScore(matchId: number, setNumber: number, scoreA: number, scoreB: number): Promise<void> {
    // UPSERT ON CONFLICT non supporté avant Android 10 (SQLite 3.24) → SELECT puis INSERT/UPDATE
    const existing = await queryOne<{ id: number }>(
      'SELECT id FROM match_scores WHERE matchId = ? AND setNumber = ?',
      [matchId, setNumber]
    )
    if (existing) {
      await run('UPDATE match_scores SET scoreA = ?, scoreB = ? WHERE id = ?', [scoreA, scoreB, existing.id])
    } else {
      await run(
        'INSERT INTO match_scores (matchId, setNumber, scoreA, scoreB) VALUES (?, ?, ?, ?)',
        [matchId, setNumber, scoreA, scoreB]
      )
    }
  },

  async getMatchScores(matchId: number): Promise<MatchScore[]> {
    return query<MatchScore>('SELECT * FROM match_scores WHERE matchId = ? ORDER BY setNumber', [matchId])
  },

  async getAllMatchScores(tournamentId: number): Promise<MatchScore[]> {
    return query<MatchScore>(`
      SELECT ms.*
      FROM match_scores ms
      JOIN matches m ON m.id = ms.matchId
      WHERE m.tournamentId = ?
      ORDER BY ms.matchId, ms.setNumber
    `, [tournamentId])
  },

  async clearMatchScores(matchId: number): Promise<void> {
    await run('DELETE FROM match_scores WHERE matchId = ?', [matchId])
  },

  async createMatchWithTeams(match: { tournamentId: number; round?: number; courtNumber?: number; teamAPlayerIds: number[]; teamBPlayerIds: number[]; category?: Match['category']; comment?: string }): Promise<Match> {
    const mResult = await run(
      'INSERT INTO matches (tournamentId, round, courtNumber, status, category, comment) VALUES (?, ?, ?, ?, ?, ?)',
      [match.tournamentId, match.round ?? null, match.courtNumber ?? null, 'pending', match.category ?? null, match.comment ?? null]
    )
    const matchId = mResult.lastId

    // Participants côté A puis B (autant que de joueurs dans chaque équipe)
    for (const side of ['A', 'B'] as const) {
      const ids = side === 'A' ? match.teamAPlayerIds : match.teamBPlayerIds
      for (const playerId of ids) {
        const tp = await queryOne<{ id: number }>(
          'SELECT id FROM tournament_players WHERE tournamentId = ? AND playerId = ?',
          [match.tournamentId, playerId]
        )
        if (tp) {
          await run('INSERT INTO match_participants (matchId, side, tournamentPlayerId) VALUES (?, ?, ?)', [matchId, side, tp.id])
        }
      }
    }

    return queryOne<Match>('SELECT * FROM matches WHERE id = ?', [matchId]) as Promise<Match>
  },

  async createPlaceholderMatch(match: { tournamentId: number; round?: number; courtNumber?: number; comment?: string; category?: Match['category'] }): Promise<Match> {
    const result = await run(
      'INSERT INTO matches (tournamentId, round, courtNumber, status, comment, category) VALUES (?, ?, ?, ?, ?, ?)',
      [match.tournamentId, match.round ?? null, match.courtNumber ?? null, 'pending', match.comment ?? null, match.category ?? null]
    )
    return queryOne<Match>('SELECT * FROM matches WHERE id = ?', [result.lastId]) as Promise<Match>
  },

  async advanceWinner(tournamentId: number, completedMatchId: number, winnerPlayerId: number): Promise<void> {
    // 1. Ronde du match terminé
    const match = await queryOne<{ round: number }>('SELECT round FROM matches WHERE id = ?', [completedMatchId])
    if (!match) return

    // 2. Position dans la ronde
    const roundMatches = await query<{ id: number }>(
      'SELECT id FROM matches WHERE tournamentId = ? AND round = ? ORDER BY id',
      [tournamentId, match.round]
    )
    const position = roundMatches.findIndex((m) => m.id === completedMatchId)
    if (position === -1) return

    // 3. Match cible en ronde suivante (null si finale → juste enregistrer le vainqueur)
    const nextRound = match.round + 1
    const nextMatches = await query<{ id: number }>(
      'SELECT id FROM matches WHERE tournamentId = ? AND round = ? ORDER BY id',
      [tournamentId, nextRound]
    )
    const targetMatch = nextMatches[Math.floor(position / 2)]

    const side = position % 2 === 0 ? 'A' : 'B'

    // 4. tournamentPlayerId du vainqueur
    const tp = await queryOne<{ id: number }>(
      'SELECT id FROM tournament_players WHERE tournamentId = ? AND playerId = ?',
      [tournamentId, winnerPlayerId]
    )
    if (!tp) return

    // 5. Identifie le côté gagnant dans le match terminé + tous ses participants (simple/doubles)
    const winnerSideRow = await queryOne<{ side: string }>(
      'SELECT side FROM match_participants WHERE matchId = ? AND tournamentPlayerId = ?',
      [completedMatchId, tp.id]
    )
    const winnerSide = winnerSideRow?.side ?? 'A'
    const winnerParticipants = await query<{ tournamentPlayerId: number }>(
      'SELECT tournamentPlayerId FROM match_participants WHERE matchId = ? AND side = ?',
      [completedMatchId, winnerSide]
    )

    // 6. Enregistre le vainqueur sur le match terminé AVANT de chercher le
    // prochain match : pour la FINALE il n'y a pas de round suivant — sans ça,
    // le champion n'était jamais persisté (winnerId restait NULL).
    await run('UPDATE matches SET winnerId = ? WHERE id = ?', [tp.id, completedMatchId])

    // Cas BYE : le joueur n'a pas de participation enregistrée — on l'avance quand même
    const finalParticipants = winnerParticipants.length > 0 ? winnerParticipants : [{ tournamentPlayerId: tp.id }]

    // Finale : pas de match suivant — le vainqueur est enregistré, on s'arrête ici
    if (!targetMatch) return

    // 7. Ne pas avancer si le créneau est déjà occupé (ex: matchs de poule round N+1)
    const occupied = await queryOne<{ c: number }>(
      'SELECT COUNT(*) as c FROM match_participants WHERE matchId = ? AND side = ?',
      [targetMatch.id, side]
    )
    if ((occupied?.c ?? 0) > 0) return

    // 8. Remplace les participants du côté cible
    await run('DELETE FROM match_participants WHERE matchId = ? AND side = ?', [targetMatch.id, side])
    for (const p of finalParticipants) {
      await run('INSERT INTO match_participants (matchId, side, tournamentPlayerId) VALUES (?, ?, ?)', [targetMatch.id, side, p.tournamentPlayerId])
    }
  },

  async seedKnockoutMatches(seeds: { matchId: number; side: 'A' | 'B'; playerIds: number[]; tournamentId: number }[]): Promise<void> {
    for (const seed of seeds) {
      await run('DELETE FROM match_participants WHERE matchId = ? AND side = ?', [seed.matchId, seed.side])
      for (const playerId of seed.playerIds) {
        const tp = await queryOne<{ id: number }>(
          'SELECT id FROM tournament_players WHERE tournamentId = ? AND playerId = ?',
          [seed.tournamentId, playerId]
        )
        if (tp) {
          await run('INSERT INTO match_participants (matchId, side, tournamentPlayerId) VALUES (?, ?, ?)', [seed.matchId, seed.side, tp.id])
        }
      }
    }
  },

  // ── Réorganisation des matchs ──
  async swapMatchSides(matchId1: number, side1: 'A' | 'B', matchId2: number, side2: 'A' | 'B'): Promise<void> {
    const parts1 = await query<{ tournamentPlayerId: number }>(
      'SELECT tournamentPlayerId FROM match_participants WHERE matchId = ? AND side = ?',
      [matchId1, side1]
    )
    const parts2 = await query<{ tournamentPlayerId: number }>(
      'SELECT tournamentPlayerId FROM match_participants WHERE matchId = ? AND side = ?',
      [matchId2, side2]
    )

    await run('DELETE FROM match_participants WHERE matchId = ? AND side = ?', [matchId1, side1])
    await run('DELETE FROM match_participants WHERE matchId = ? AND side = ?', [matchId2, side2])

    for (const p of parts2) {
      await run('INSERT INTO match_participants (matchId, side, tournamentPlayerId) VALUES (?, ?, ?)', [matchId1, side1, p.tournamentPlayerId])
    }
    for (const p of parts1) {
      await run('INSERT INTO match_participants (matchId, side, tournamentPlayerId) VALUES (?, ?, ?)', [matchId2, side2, p.tournamentPlayerId])
    }
  },

  async swapMatchPositions(matchId1: number, matchId2: number): Promise<void> {
    const m1 = await queryOne<{ round: number | null; courtNumber: number | null }>(
      'SELECT round, courtNumber FROM matches WHERE id = ?', [matchId1]
    )
    const m2 = await queryOne<{ round: number | null; courtNumber: number | null }>(
      'SELECT round, courtNumber FROM matches WHERE id = ?', [matchId2]
    )
    if (!m1 || !m2) return
    await run('UPDATE matches SET round = ?, courtNumber = ? WHERE id = ?', [m2.round, m2.courtNumber, matchId1])
    await run('UPDATE matches SET round = ?, courtNumber = ? WHERE id = ?', [m1.round, m1.courtNumber, matchId2])
  },

  async updateMatchCourtNumber(matchId: number, courtNumber: number | null): Promise<void> {
    await run('UPDATE matches SET courtNumber = ? WHERE id = ?', [courtNumber, matchId])
  },

  async clearTournamentMatches(tournamentId: number): Promise<void> {
    // Matchs du tournoi → suppression scores, participants puis matchs
    const matchIds = await query<{ id: number }>('SELECT id FROM matches WHERE tournamentId = ?', [tournamentId])
    for (const m of matchIds) {
      await run('DELETE FROM match_scores WHERE matchId = ?', [m.id])
      await run('DELETE FROM match_participants WHERE matchId = ?', [m.id])
    }
    await run('DELETE FROM matches WHERE tournamentId = ?', [tournamentId])
  },

  // ── Admin / dev ──
  async seedTestPlayers(): Promise<void> {
    const count = await queryOne<{ n: number }>('SELECT COUNT(*) as n FROM players')
    if ((count?.n ?? 0) > 0) return
    const data: [string, string, string, string, string, number, string][] = [
      ['Thomas',  'Dupont',    'M', 'Avancé',        'ST MARS',  1420, 'active'],
      ['Lucas',   'Moreau',    'M', 'Avancé',        'VERTOU',   1380, 'active'],
      ['Mathieu', 'Bernard',   'M', 'Intermédiaire', 'ST MARS',  1210, 'active'],
      ['Kevin',   'Leroy',     'M', 'Intermédiaire', 'NANTES',   1185, 'active'],
      ['Julien',  'Simon',     'M', 'Intermédiaire', 'REZÉ',     1160, 'active'],
      ['Romain',  'Laurent',   'M', 'Intermédiaire', 'VERTOU',   1140, 'active'],
      ['Antoine', 'Petit',     'M', 'Débutant',      'NANTES',    980, 'active'],
      ['Pierre',  'Garcia',    'M', 'Débutant',      'ST MARS',   950, 'active'],
      ['Nicolas', 'Martin',    'M', 'Débutant',      'REZÉ',      920, 'active'],
      ['Camille', 'Rousseau',  'F', 'Avancé',        'VERTOU',   1350, 'active'],
      ['Sophie',  'Girard',    'F', 'Avancé',        'NANTES',   1290, 'active'],
      ['Julie',   'Fontaine',  'F', 'Intermédiaire', 'ST MARS',  1180, 'active'],
      ['Marine',  'Leclerc',   'F', 'Intermédiaire', 'REZÉ',     1130, 'active'],
      ['Lucie',   'Bonnet',    'F', 'Intermédiaire', 'NANTES',   1100, 'active'],
      ['Emma',    'Chevalier', 'F', 'Débutant',      'VERTOU',    960, 'active'],
      ['Claire',  'Dubois',    'F', 'Débutant',      'ST MARS',   930, 'active'],
    ]
    for (const row of data) {
      await run(
        'INSERT INTO players (firstName, lastName, gender, level, club, elo, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        row
      )
    }
  },

  async clearAllData(): Promise<void> {
    await run('DELETE FROM match_scores')
    await run('DELETE FROM match_participants')
    await run('DELETE FROM matches')
    await run('DELETE FROM tournament_players')
    await run('DELETE FROM tournaments')
    await run('DELETE FROM players')
    // Réinitialise les auto-incréments
    await run(
      "DELETE FROM sqlite_sequence WHERE name IN ('match_scores','match_participants','matches','tournament_players','tournaments','players')"
    )
  },

  // ── Sauvegarde / restauration ──
  async importTournament(snapshot: unknown): Promise<{ tournamentId: number }> {
    const snap = snapshot as {
      tournament: Record<string, unknown>
      players: Array<{
        firstName: string; lastName: string; pseudo?: string; gender: string
        level: string; club?: string; elo?: number; playerNumber?: number
        seed?: number; teamSide?: string
      }>
      matches: Array<{
        round?: number; courtNumber?: number; status: string
        category?: string; comment?: string
        teamAIndices: number[]; teamBIndices: number[]
        winnerSide?: string
        scores: Array<{ setNumber: number; scoreA: number; scoreB: number }>
      }>
    }

    // 1. Créer le tournoi
    const t = snap.tournament
    const tResult = await run(
      'INSERT INTO tournaments (name, date, location, courtCount, poolCount, format, status, scoringRuleId, categories, teamMode, teamAName, teamBName, teamNames) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        String(t.name ?? ''), String(t.date ?? ''),
        t.location ? String(t.location) : null,
        Number(t.courtCount ?? 4), Number(t.poolCount ?? 2),
        String(t.format ?? 'round-robin'), String(t.status ?? 'draft'),
        t.scoringRuleId ? Number(t.scoringRuleId) : null,
        Array.isArray(t.categories) ? JSON.stringify(t.categories) : '[]',
        Number(t.teamMode ?? 0),
        t.teamAName ? String(t.teamAName) : null,
        t.teamBName ? String(t.teamBName) : null,
        Array.isArray(t.teamNames) ? JSON.stringify(t.teamNames) : null,
      ]
    )
    const newTournamentId = tResult.lastId

    // 2. Créer/retrouver les joueurs puis les inscrire (réutilise même prénom + nom)
    const playerIdMap: number[] = []
    for (const sp of snap.players) {
      let player = await queryOne<{ id: number }>(
        'SELECT id FROM players WHERE firstName = ? AND lastName = ?',
        [sp.firstName, sp.lastName]
      )
      if (!player) {
        const pResult = await run(
          'INSERT INTO players (firstName, lastName, pseudo, gender, level, club, elo, playerNumber, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [sp.firstName, sp.lastName, sp.pseudo ?? null, sp.gender, sp.level, sp.club ?? null, sp.elo ?? 1000, sp.playerNumber ?? null, 'active']
        )
        player = { id: pResult.lastId }
      }

      await run(
        'INSERT INTO tournament_players (tournamentId, playerId, seed, teamSide) VALUES (?, ?, ?, ?)',
        [newTournamentId, player.id, sp.seed ?? null, sp.teamSide ?? null]
      )
      playerIdMap.push(player.id)
    }

    // 3. Créer les matchs avec participants et scores
    for (const sm of snap.matches) {
      const mResult = await run(
        'INSERT INTO matches (tournamentId, round, courtNumber, status, category, comment) VALUES (?, ?, ?, ?, ?, ?)',
        [newTournamentId, sm.round ?? null, sm.courtNumber ?? null, sm.status, sm.category ?? null, sm.comment ?? null]
      )
      const matchId = mResult.lastId

      // Participants (résolution index → joueur → tournament_player)
      const addParticipants = async (indices: number[], side: 'A' | 'B') => {
        for (const idx of indices) {
          if (idx < 0 || idx >= playerIdMap.length) continue
          const playerId = playerIdMap[idx]
          const tp = await queryOne<{ id: number }>(
            'SELECT id FROM tournament_players WHERE tournamentId = ? AND playerId = ?',
            [newTournamentId, playerId]
          )
          if (tp) {
            await run('INSERT INTO match_participants (matchId, side, tournamentPlayerId) VALUES (?, ?, ?)', [matchId, side, tp.id])
          }
        }
      }
      await addParticipants(sm.teamAIndices, 'A')
      await addParticipants(sm.teamBIndices, 'B')

      // Scores set par set
      for (const score of sm.scores) {
        await run(
          'INSERT INTO match_scores (matchId, setNumber, scoreA, scoreB) VALUES (?, ?, ?, ?)',
          [matchId, score.setNumber, score.scoreA, score.scoreB]
        )
      }

      // Vainqueur (winnerId = tournament_players.id du premier joueur du côté gagnant)
      if (sm.winnerSide === 'A' || sm.winnerSide === 'B') {
        const winnerIndices = sm.winnerSide === 'A' ? sm.teamAIndices : sm.teamBIndices
        if (winnerIndices.length > 0) {
          const winnerPlayerId = playerIdMap[winnerIndices[0]]
          const winnerTp = await queryOne<{ id: number }>(
            'SELECT id FROM tournament_players WHERE tournamentId = ? AND playerId = ?',
            [newTournamentId, winnerPlayerId]
          )
          if (winnerTp) {
            await run('UPDATE matches SET winnerId = ? WHERE id = ?', [winnerTp.id, matchId])
          }
        }
      }
    }

    return { tournamentId: newTournamentId }
  },

  // ── Import sauvegarde complète ──
  async importFullBackup(backup: unknown): Promise<{
    playersImported: number
    rulesImported: number
    tournamentsImported: number
  }> {
    const b = backup as {
      players?: Array<{
        firstName: string; lastName: string; pseudo?: string; gender: string
        level: string; club?: string; elo?: number; playerNumber?: number; status?: string
      }>
      scoringRules?: Array<{
        name: string; setsToWin: number; pointsPerSet: number
        hasDeuce: boolean; maxScore: number; goldenPoint: boolean
      }>
      tournaments?: Array<{
        id?: number
        name: string; date: string; location?: string
        courtCount?: number; poolCount?: number
        format: string; status?: string; scoringRuleId?: number
        categories?: string[]; teamMode?: number
        teamAName?: string; teamBName?: string; teamNames?: string[]
        tournamentPlayers?: Array<{
          playerId: number; seed?: number; teamSide?: string
          firstName?: string; lastName?: string
          pseudo?: string; gender?: string; level?: string
        }>
        matches?: Array<{
          id?: number
          round?: number; courtNumber?: number; status: string
          category?: string; comment?: string
          teamA?: string; teamB?: string
          winnerSide?: string
        }>
        matchScores?: Array<{ matchId: number; setNumber: number; scoreA: number; scoreB: number }>
      }>
    }

    // Joueurs : insertion avec dédoublonnage prénom+nom (comme importTournament)
    let playersImported = 0
    for (const p of b.players ?? []) {
      const existing = await queryOne<{ id: number }>(
        'SELECT id FROM players WHERE firstName = ? AND lastName = ?',
        [p.firstName, p.lastName]
      )
      if (existing) continue
      await run(
        'INSERT INTO players (firstName, lastName, pseudo, gender, level, club, elo, playerNumber, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [p.firstName, p.lastName, p.pseudo ?? null, p.gender, p.level, p.club ?? null, p.elo ?? 1000, p.playerNumber ?? null, p.status ?? 'active']
      )
      playersImported++
    }

    // Règles custom : recréées (les presets officiels existent déjà via le schéma)
    let rulesImported = 0
    for (const r of b.scoringRules ?? []) {
      const existing = await queryOne<{ id: number }>('SELECT id FROM scoring_rules WHERE name = ?', [r.name])
      if (existing) continue
      await run(
        'INSERT INTO scoring_rules (name, setsToWin, pointsPerSet, hasDeuce, maxScore, goldenPoint, isCustom) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [r.name, r.setsToWin, r.pointsPerSet, r.hasDeuce ? 1 : 0, r.maxScore, r.goldenPoint ? 1 : 0]
      )
      rulesImported++
    }

    // Tournois : la sauvegarde contient tournamentPlayers (avec noms joints via
    // le SELECT de getTournamentPlayers), matches (teamA/teamB = playerIds texte,
    // id conservé) et matchScores (matchId = id du match dans la sauvegarde).
    // On reconstruit un snapshot tournoi standard (indices) → importTournament
    // gère la création + dédoublonnage des joueurs.
    let tournamentsImported = 0
    for (const t of b.tournaments ?? []) {
      const tps = t.tournamentPlayers ?? []
      const players = tps.map((tp) => ({
        firstName: tp.firstName ?? `Joueur ${tp.playerId}`,
        lastName: tp.lastName ?? `#${tp.playerId}`,
        pseudo: (tp as { pseudo?: string }).pseudo,
        gender: (tp as { gender?: string }).gender === 'F' ? 'F' : 'M',
        level: (tp as { level?: string }).level ?? 'Intermédiaire',
        seed: tp.seed,
        teamSide: tp.teamSide,
      }))
      // Map playerId (ancienne base) → index dans le snapshot
      const playerIdToIndex = new Map<number, number>()
      tps.forEach((tp, idx) => playerIdToIndex.set(tp.playerId, idx))

      const idToScores = new Map<number, Array<{ setNumber: number; scoreA: number; scoreB: number }>>()
      for (const ms of t.matchScores ?? []) {
        const list = idToScores.get(ms.matchId) ?? []
        list.push({ setNumber: ms.setNumber, scoreA: ms.scoreA, scoreB: ms.scoreB })
        idToScores.set(ms.matchId, list)
      }

      const snapshot = {
        version: 1 as const,
        exportedAt: new Date().toISOString(),
        tournament: {
          name: t.name,
          date: t.date,
          location: t.location,
          courtCount: t.courtCount ?? 4,
          poolCount: t.poolCount ?? 2,
          format: t.format,
          status: t.status ?? 'draft',
          scoringRuleId: t.scoringRuleId,
          categories: t.categories ?? [],
          teamMode: t.teamMode ?? 0,
          teamAName: t.teamAName,
          teamBName: t.teamBName,
          teamNames: t.teamNames,
        },
        players,
        matches: (t.matches ?? []).map((m) => {
          const parseIndices = (csv: string | undefined) =>
            (csv ?? '').split(',').filter(Boolean).map((s) => playerIdToIndex.get(Number(s)) ?? -1).filter((i) => i >= 0)
          return {
            round: m.round,
            courtNumber: m.courtNumber,
            status: m.status,
            category: m.category,
            comment: m.comment,
            teamAIndices: parseIndices((m as { teamA?: string }).teamA),
            teamBIndices: parseIndices((m as { teamB?: string }).teamB),
            winnerSide: m.winnerSide,
            scores: idToScores.get((m as { id?: number }).id ?? -1) ?? [],
          }
        }),
      }

      try {
        await this.importTournament(snapshot)
        tournamentsImported++
      } catch {
        // Tournoi mal formé : on ignore et continue (import best-effort)
      }
    }

    return { playersImported, rulesImported, tournamentsImported }
  },

  // ── Fenêtre secondaire ──
  // Android : pas de multi-fenêtres WebView. Le plein écran du match reste
  // disponible via la vue arbitre ; l'écran secondaire de diffusion devra
  // passer par un second appareil ou une v2 (browser tab).
  async openNewWindow(_hash: string): Promise<void> {
    void _hash
  },
}