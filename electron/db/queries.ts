import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { runMigrations } from './migrations/runner'

let db: Database.Database

export function initDb(): void {
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'shuttlecup.db')

  // Chemin du schéma : relatif à __dirname en dev, dans resourcesPath en prod
  const schemaPath = app.isPackaged
    ? path.join(process.resourcesPath, 'db', 'schema.sql')
    : path.join(__dirname, '../electron/db/schema.sql')

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const schema = fs.readFileSync(schemaPath, 'utf-8')
  db.exec(schema)
  runMigrations(db)
  console.log('Base de données initialisée:', dbPath)
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Base de données non initialisée. Appelez initDb() d\'abord.')
  return db
}

// --- Joueurs ---

export const playerQueries = {
  getAll(): unknown[] {
    return getDb().prepare(`
      SELECT p.*, COUNT(DISTINCT tp.tournamentId) AS tournamentCount
      FROM players p
      LEFT JOIN tournament_players tp ON tp.playerId = p.id
      GROUP BY p.id
      ORDER BY p.elo DESC NULLS LAST, p.lastName, p.firstName
    `).all()
  },

  create(p: {
    firstName: string
    lastName: string
    pseudo?: string
    gender: string
    level: string
    club?: string
    elo?: number
    playerNumber?: number
    status?: string
  }): unknown {
    const stmt = getDb().prepare(
      'INSERT INTO players (firstName, lastName, pseudo, gender, level, club, elo, playerNumber, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    const result = stmt.run(
      p.firstName, p.lastName, p.pseudo ?? null, p.gender, p.level,
      p.club ?? null, p.elo ?? 1000, p.playerNumber ?? null, p.status ?? 'active'
    )
    return getDb().prepare(`
      SELECT p.*, COUNT(DISTINCT tp.tournamentId) AS tournamentCount
      FROM players p
      LEFT JOIN tournament_players tp ON tp.playerId = p.id
      WHERE p.id = ?
      GROUP BY p.id
    `).get(result.lastInsertRowid)
  },

  update(id: number, data: Record<string, unknown>): unknown {
    const allowed = ['firstName', 'lastName', 'pseudo', 'gender', 'level', 'club', 'elo', 'playerNumber', 'status']
    const fields = Object.keys(data).filter((k) => allowed.includes(k))
    if (fields.length === 0) {
      return getDb().prepare(`
        SELECT p.*, COUNT(DISTINCT tp.tournamentId) AS tournamentCount
        FROM players p LEFT JOIN tournament_players tp ON tp.playerId = p.id
        WHERE p.id = ? GROUP BY p.id
      `).get(id)
    }

    const setClause = fields.map((f) => `${f} = ?`).join(', ')
    const values = fields.map((f) => data[f])
    getDb().prepare(`UPDATE players SET ${setClause} WHERE id = ?`).run(...values, id)
    return getDb().prepare(`
      SELECT p.*, COUNT(DISTINCT tp.tournamentId) AS tournamentCount
      FROM players p LEFT JOIN tournament_players tp ON tp.playerId = p.id
      WHERE p.id = ? GROUP BY p.id
    `).get(id)
  },

  delete(id: number): void {
    getDb().prepare('DELETE FROM players WHERE id = ?').run(id)
  },
}

// --- Règles de scoring ---

export const scoringRuleQueries = {
  getAll(): unknown[] {
    return getDb()
      .prepare('SELECT * FROM scoring_rules ORDER BY isCustom, id')
      .all()
      .map((row) => boolifyRule(row as Record<string, unknown>))
  },

  create(rule: {
    name: string
    setsToWin: number
    pointsPerSet: number
    hasDeuce: boolean
    maxScore: number
    goldenPoint: boolean
  }): unknown {
    const stmt = getDb().prepare(
      'INSERT INTO scoring_rules (name, setsToWin, pointsPerSet, hasDeuce, maxScore, goldenPoint, isCustom) VALUES (?, ?, ?, ?, ?, ?, 1)'
    )
    const result = stmt.run(
      rule.name, rule.setsToWin, rule.pointsPerSet,
      rule.hasDeuce ? 1 : 0, rule.maxScore, rule.goldenPoint ? 1 : 0
    )
    const row = getDb().prepare('SELECT * FROM scoring_rules WHERE id = ?').get(result.lastInsertRowid)
    return boolifyRule(row as Record<string, unknown>)
  },

  update(id: number, data: Record<string, unknown>): unknown {
    const allowed = ['name', 'setsToWin', 'pointsPerSet', 'hasDeuce', 'maxScore', 'goldenPoint']
    const fields = Object.keys(data).filter((k) => allowed.includes(k))
    if (fields.length === 0) return getDb().prepare('SELECT * FROM scoring_rules WHERE id = ?').get(id)

    const setClause = fields.map((f) => `${f} = ?`).join(', ')
    const values = fields.map((f) => {
      const v = data[f]
      if (f === 'hasDeuce' || f === 'goldenPoint') return v ? 1 : 0
      return v
    })
    getDb().prepare(`UPDATE scoring_rules SET ${setClause} WHERE id = ?`).run(...values, id)
    const row = getDb().prepare('SELECT * FROM scoring_rules WHERE id = ?').get(id)
    return boolifyRule(row as Record<string, unknown>)
  },

  delete(id: number): void {
    getDb().prepare('DELETE FROM scoring_rules WHERE id = ? AND isCustom = 1').run(id)
  },
}

// --- Tournois ---

function parseTournament(row: Record<string, unknown>): Record<string, unknown> {
  let categories: string[] = []
  try { categories = JSON.parse((row.categories as string | null) ?? '[]') } catch { /* vide */ }
  let teamNames: string[] | undefined
  if (row.teamNames) {
    try { teamNames = JSON.parse(row.teamNames as string) } catch { /* vide */ }
  }
  return { ...row, categories, teamNames, poolCount: (row.poolCount as number | null) ?? 2 }
}

export const tournamentQueries = {
  getAll(): unknown[] {
    return getDb().prepare('SELECT * FROM tournaments ORDER BY date DESC').all()
      .map((r) => parseTournament(r as Record<string, unknown>))
  },

  create(t: {
    name: string
    date: string
    location?: string
    courtCount?: number
    poolCount?: number
    logoPath?: string
    format: string
    scoringRuleId?: number
    categories?: string[]
    teamMode?: number
    teamAName?: string
    teamBName?: string
    teamNames?: string[]
  }): unknown {
    const stmt = getDb().prepare(
      'INSERT INTO tournaments (name, date, location, courtCount, poolCount, logoPath, format, scoringRuleId, categories, teamMode, teamAName, teamBName, teamNames) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    const result = stmt.run(
      t.name, t.date, t.location ?? null, t.courtCount ?? 4,
      t.poolCount ?? 2,
      t.logoPath ?? null, t.format, t.scoringRuleId ?? null,
      JSON.stringify(t.categories ?? []),
      t.teamMode ?? 0, t.teamAName ?? null, t.teamBName ?? null,
      t.teamNames ? JSON.stringify(t.teamNames) : null
    )
    const row = getDb().prepare('SELECT * FROM tournaments WHERE id = ?').get(result.lastInsertRowid)
    return parseTournament(row as Record<string, unknown>)
  },

  update(id: number, data: Record<string, unknown>): unknown {
    const allowed = ['name', 'date', 'location', 'courtCount', 'poolCount', 'logoPath', 'format', 'status', 'scoringRuleId', 'categories', 'teamMode', 'teamAName', 'teamBName', 'teamNames']
    const fields = Object.keys(data).filter((k) => allowed.includes(k))
    if (fields.length === 0) {
      const row = getDb().prepare('SELECT * FROM tournaments WHERE id = ?').get(id)
      return parseTournament(row as Record<string, unknown>)
    }

    const setClause = fields.map((f) => `${f} = ?`).join(', ')
    const values = fields.map((f) => {
      if (f === 'categories') return JSON.stringify(data[f])
      if (f === 'teamNames') return JSON.stringify(data[f])
      return data[f]
    })
    getDb().prepare(`UPDATE tournaments SET ${setClause} WHERE id = ?`).run(...values, id)
    const row = getDb().prepare('SELECT * FROM tournaments WHERE id = ?').get(id)
    return parseTournament(row as Record<string, unknown>)
  },

  delete(id: number): void {
    getDb().prepare('DELETE FROM tournaments WHERE id = ?').run(id)
  },
}

// --- Joueurs inscrits à un tournoi ---

export const tournamentPlayerQueries = {
  getAll(tournamentId: number): unknown[] {
    return getDb().prepare(`
      SELECT tp.*, p.firstName, p.lastName, p.pseudo, p.gender, p.level
      FROM tournament_players tp
      JOIN players p ON p.id = tp.playerId
      WHERE tp.tournamentId = ?
      ORDER BY tp.seed, p.lastName
    `).all(tournamentId)
  },

  add(tournamentId: number, playerId: number, seed?: number): unknown {
    const stmt = getDb().prepare(
      'INSERT INTO tournament_players (tournamentId, playerId, seed) VALUES (?, ?, ?)'
    )
    const result = stmt.run(tournamentId, playerId, seed ?? null)
    return getDb().prepare('SELECT * FROM tournament_players WHERE id = ?').get(result.lastInsertRowid)
  },

  remove(tournamentPlayerId: number): void {
    getDb().prepare('DELETE FROM tournament_players WHERE id = ?').run(tournamentPlayerId)
  },

  /** Définit le côté d'équipe d'un joueur inscrit (lettre : 'A', 'B', 'C', ...). */
  setTeamSide(tournamentPlayerId: number, side: string | null): void {
    getDb().prepare('UPDATE tournament_players SET teamSide = ? WHERE id = ?').run(side, tournamentPlayerId)
  },
}

// --- Matchs ---

// --- Matchs ---

export const matchQueries = {
  /** Supprime tous les matchs (+ participants + scores) d'un tournoi — pour réinitialiser avant régénération. */
  clearForTournament(tournamentId: number): void {
    const db = getDb()
    db.transaction(() => {
      const matchIds = db.prepare('SELECT id FROM matches WHERE tournamentId = ?').all(tournamentId) as { id: number }[]
      for (const m of matchIds) {
        db.prepare('DELETE FROM match_scores WHERE matchId = ?').run(m.id)
        db.prepare('DELETE FROM match_participants WHERE matchId = ?').run(m.id)
      }
      db.prepare('DELETE FROM matches WHERE tournamentId = ?').run(tournamentId)
    })()
  },

  /** Échange les participants de deux slots (côtés) dans deux matchs — pour réorganisation avant lancement. */
  swapMatchSides(matchId1: number, side1: 'A' | 'B', matchId2: number, side2: 'A' | 'B'): void {
    const db = getDb()
    db.transaction(() => {
      const parts1 = db.prepare(
        'SELECT tournamentPlayerId FROM match_participants WHERE matchId = ? AND side = ?'
      ).all(matchId1, side1) as { tournamentPlayerId: number }[]
      const parts2 = db.prepare(
        'SELECT tournamentPlayerId FROM match_participants WHERE matchId = ? AND side = ?'
      ).all(matchId2, side2) as { tournamentPlayerId: number }[]

      db.prepare('DELETE FROM match_participants WHERE matchId = ? AND side = ?').run(matchId1, side1)
      db.prepare('DELETE FROM match_participants WHERE matchId = ? AND side = ?').run(matchId2, side2)

      for (const p of parts2) {
        db.prepare('INSERT INTO match_participants (matchId, side, tournamentPlayerId) VALUES (?, ?, ?)')
          .run(matchId1, side1, p.tournamentPlayerId)
      }
      for (const p of parts1) {
        db.prepare('INSERT INTO match_participants (matchId, side, tournamentPlayerId) VALUES (?, ?, ?)')
          .run(matchId2, side2, p.tournamentPlayerId)
      }
    })()
  },

  getAll(tournamentId: number): unknown[] {
    // Retourne les IDs joueurs dans teamA/teamB pour que l'engine puisse les identifier
    return getDb().prepare(`
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
    `).all(tournamentId)
  },

  create(match: {
    tournamentId: number
    round?: number
    courtNumber?: number
    playerAId: number
    playerBId: number
    category?: string
    comment?: string
  }): unknown {
    // Insère le match
    const matchResult = getDb()
      .prepare('INSERT INTO matches (tournamentId, round, courtNumber, status, category, comment) VALUES (?, ?, ?, ?, ?, ?)')
      .run(match.tournamentId, match.round ?? null, match.courtNumber ?? null, 'pending', match.category ?? null, match.comment ?? null)
    const matchId = matchResult.lastInsertRowid as number

    // Retrouve les tournament_player IDs
    const tpA = getDb()
      .prepare('SELECT id FROM tournament_players WHERE tournamentId = ? AND playerId = ?')
      .get(match.tournamentId, match.playerAId) as { id: number } | undefined
    const tpB = getDb()
      .prepare('SELECT id FROM tournament_players WHERE tournamentId = ? AND playerId = ?')
      .get(match.tournamentId, match.playerBId) as { id: number } | undefined

    if (tpA && tpB) {
      getDb().prepare('INSERT INTO match_participants (matchId, side, tournamentPlayerId) VALUES (?, ?, ?)')
        .run(matchId, 'A', tpA.id)
      getDb().prepare('INSERT INTO match_participants (matchId, side, tournamentPlayerId) VALUES (?, ?, ?)')
        .run(matchId, 'B', tpB.id)
    }

    return getDb().prepare('SELECT * FROM matches WHERE id = ?').get(matchId)
  },

  /** Crée un match avec plusieurs joueurs par équipe (doubles). */
  createWithTeams(match: {
    tournamentId: number
    round?: number
    courtNumber?: number
    teamAPlayerIds: number[]
    teamBPlayerIds: number[]
    category?: string
    comment?: string
  }): unknown {
    const db = getDb()
    const matchResult = db
      .prepare('INSERT INTO matches (tournamentId, round, courtNumber, status, category, comment) VALUES (?, ?, ?, ?, ?, ?)')
      .run(match.tournamentId, match.round ?? null, match.courtNumber ?? null, 'pending', match.category ?? null, match.comment ?? null)
    const matchId = matchResult.lastInsertRowid as number

    // Insère les participants côté A (autant que de joueurs dans l'équipe)
    for (const playerId of match.teamAPlayerIds) {
      const tp = db
        .prepare('SELECT id FROM tournament_players WHERE tournamentId = ? AND playerId = ?')
        .get(match.tournamentId, playerId) as { id: number } | undefined
      if (tp) {
        db.prepare('INSERT INTO match_participants (matchId, side, tournamentPlayerId) VALUES (?, ?, ?)')
          .run(matchId, 'A', tp.id)
      }
    }

    // Insère les participants côté B
    for (const playerId of match.teamBPlayerIds) {
      const tp = db
        .prepare('SELECT id FROM tournament_players WHERE tournamentId = ? AND playerId = ?')
        .get(match.tournamentId, playerId) as { id: number } | undefined
      if (tp) {
        db.prepare('INSERT INTO match_participants (matchId, side, tournamentPlayerId) VALUES (?, ?, ?)')
          .run(matchId, 'B', tp.id)
      }
    }

    return db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId)
  },

  updateStatus(matchId: number, status: string, winnerId?: number): void {
    getDb()
      .prepare('UPDATE matches SET status = ?, winnerId = ? WHERE id = ?')
      .run(status, winnerId ?? null, matchId)
  },

  setScore(matchId: number, setNumber: number, scoreA: number, scoreB: number): void {
    getDb().prepare(`
      INSERT INTO match_scores (matchId, setNumber, scoreA, scoreB)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(matchId, setNumber) DO UPDATE SET scoreA = excluded.scoreA, scoreB = excluded.scoreB
    `).run(matchId, setNumber, scoreA, scoreB)
  },

  getScores(matchId: number): unknown[] {
    return getDb()
      .prepare('SELECT * FROM match_scores WHERE matchId = ? ORDER BY setNumber')
      .all(matchId)
  },

  /** Crée un match placeholder sans participants (bracket rounds futurs). */
  createPlaceholder(match: {
    tournamentId: number
    round?: number
    courtNumber?: number
    comment?: string
    category?: string
  }): unknown {
    const result = getDb()
      .prepare('INSERT INTO matches (tournamentId, round, courtNumber, status, comment, category) VALUES (?, ?, ?, ?, ?, ?)')
      .run(match.tournamentId, match.round ?? null, match.courtNumber ?? null, 'pending', match.comment ?? null, match.category ?? null)
    return getDb().prepare('SELECT * FROM matches WHERE id = ?').get(result.lastInsertRowid)
  },

  /**
   * Avance le gagnant d'un match dans le prochain match du bracket.
   * Trouve la position du match terminé dans sa ronde, puis localise le
   * match cible en ronde+1 (floor(pos/2)) et y insère le joueur gagnant.
   */
  advanceWinner(tournamentId: number, completedMatchId: number, winnerPlayerId: number): void {
    const db = getDb()
    const match = db.prepare('SELECT round FROM matches WHERE id = ?').get(completedMatchId) as { round: number } | undefined
    if (!match) return

    const roundMatches = db.prepare(
      'SELECT id FROM matches WHERE tournamentId = ? AND round = ? ORDER BY id'
    ).all(tournamentId, match.round) as { id: number }[]

    const position = roundMatches.findIndex((m) => m.id === completedMatchId)
    if (position === -1) return

    const nextRound = match.round + 1
    const nextMatches = db.prepare(
      'SELECT id FROM matches WHERE tournamentId = ? AND round = ? ORDER BY id'
    ).all(tournamentId, nextRound) as { id: number }[]

    const targetMatch = nextMatches[Math.floor(position / 2)]
    if (!targetMatch) return

    const side = position % 2 === 0 ? 'A' : 'B'

    // Retrouve le tournamentPlayerId du vainqueur
    const tp = db.prepare(
      'SELECT id FROM tournament_players WHERE tournamentId = ? AND playerId = ?'
    ).get(tournamentId, winnerPlayerId) as { id: number } | undefined
    if (!tp) return

    // Identifie le côté gagnant dans le match terminé (A ou B)
    const winnerSideRow = db.prepare(
      'SELECT side FROM match_participants WHERE matchId = ? AND tournamentPlayerId = ?'
    ).get(completedMatchId, tp.id) as { side: string } | undefined
    const winnerSide = winnerSideRow?.side ?? 'A'

    // Récupère TOUS les participants de ce côté (simple = 1, doubles = 2)
    const winnerParticipants = db.prepare(
      'SELECT tournamentPlayerId FROM match_participants WHERE matchId = ? AND side = ?'
    ).all(completedMatchId, winnerSide) as { tournamentPlayerId: number }[]

    // Enregistre le vainqueur sur le match terminé (référence tournament_players.id)
    db.prepare('UPDATE matches SET winnerId = ? WHERE id = ?').run(tp.id, completedMatchId)

    // Cas BYE : le joueur n'a pas de participation enregistrée — on l'avance quand même
    const finalParticipants: { tournamentPlayerId: number }[] =
      winnerParticipants.length > 0 ? winnerParticipants : [{ tournamentPlayerId: tp.id }]

    // Ne pas avancer si le créneau est déjà occupé (ex: matchs de poule round N+1)
    const occupied = db.prepare(
      'SELECT COUNT(*) as c FROM match_participants WHERE matchId = ? AND side = ?'
    ).get(targetMatch.id, side) as { c: number }
    if (occupied.c > 0) return

    // Remplace les participants du côté cible dans le prochain match
    db.prepare('DELETE FROM match_participants WHERE matchId = ? AND side = ?').run(targetMatch.id, side)
    for (const p of finalParticipants) {
      db.prepare('INSERT INTO match_participants (matchId, side, tournamentPlayerId) VALUES (?, ?, ?)')
        .run(targetMatch.id, side, p.tournamentPlayerId)
    }
  },

  /** Retourne tous les scores de tous les matchs d'un tournoi en une seule requête. */
  getAllScores(tournamentId: number): unknown[] {
    return getDb().prepare(`
      SELECT ms.*
      FROM match_scores ms
      JOIN matches m ON m.id = ms.matchId
      WHERE m.tournamentId = ?
      ORDER BY ms.matchId, ms.setNumber
    `).all(tournamentId)
  },

  /** Supprime tous les scores d'un match (avant réinitialisation). */
  clearMatchScores(matchId: number): void {
    getDb().prepare('DELETE FROM match_scores WHERE matchId = ?').run(matchId)
  },

  /**
   * Insère les participants dans les matchs de knockout d'après les qualifiants des poules.
   * Chaque seed définit le matchId, le côté (A ou B) et les playerIds à placer.
   */
  seedKnockoutMatches(seeds: { matchId: number; side: 'A' | 'B'; playerIds: number[]; tournamentId: number }[]): void {
    const db = getDb()
    for (const seed of seeds) {
      db.prepare('DELETE FROM match_participants WHERE matchId = ? AND side = ?').run(seed.matchId, seed.side)
      for (const playerId of seed.playerIds) {
        const tp = db.prepare(
          'SELECT id FROM tournament_players WHERE tournamentId = ? AND playerId = ?'
        ).get(seed.tournamentId, playerId) as { id: number } | undefined
        if (tp) {
          db.prepare('INSERT INTO match_participants (matchId, side, tournamentPlayerId) VALUES (?, ?, ?)')
            .run(seed.matchId, seed.side, tp.id)
        }
      }
    }
  },

  /**
   * Échange le round et le courtNumber de deux matchs — pour réorganiser le planning sans toucher aux participants.
   */
  swapMatchPositions(matchId1: number, matchId2: number): void {
    const db = getDb()
    db.transaction(() => {
      const m1 = db.prepare('SELECT round, courtNumber FROM matches WHERE id = ?').get(matchId1) as { round: number | null; courtNumber: number | null } | undefined
      const m2 = db.prepare('SELECT round, courtNumber FROM matches WHERE id = ?').get(matchId2) as { round: number | null; courtNumber: number | null } | undefined
      if (!m1 || !m2) return
      db.prepare('UPDATE matches SET round = ?, courtNumber = ? WHERE id = ?').run(m2.round, m2.courtNumber, matchId1)
      db.prepare('UPDATE matches SET round = ?, courtNumber = ? WHERE id = ?').run(m1.round, m1.courtNumber, matchId2)
    })()
  },

  /** Met à jour le terrain d'un match. */
  updateMatchCourtNumber(matchId: number, courtNumber: number | null): void {
    getDb().prepare('UPDATE matches SET courtNumber = ? WHERE id = ?').run(courtNumber, matchId)
  },
}

// --- Admin ---

export const adminQueries = {
  /** Insère 16 joueurs de test (ne fait rien si des joueurs existent déjà). */
  seedTestPlayers(): void {
    const db = getDb()
    const count = (db.prepare('SELECT COUNT(*) as n FROM players').get() as { n: number }).n
    if (count > 0) return
    const insert = db.prepare(
      'INSERT INTO players (firstName, lastName, gender, level, club, elo, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    db.transaction(() => {
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
      for (const row of data) insert.run(...row)
    })()
  },

  /** Supprime toutes les données utilisateur (joueurs, tournois, matchs, scores). */
  clearAllData(): void {
    const db = getDb()
    db.transaction(() => {
      db.prepare('DELETE FROM match_scores').run()
      db.prepare('DELETE FROM match_participants').run()
      db.prepare('DELETE FROM matches').run()
      db.prepare('DELETE FROM tournament_players').run()
      db.prepare('DELETE FROM tournaments').run()
      db.prepare('DELETE FROM players').run()
      // Réinitialise les auto-incréments
      db.prepare(
        "DELETE FROM sqlite_sequence WHERE name IN ('match_scores','match_participants','matches','tournament_players','tournaments','players')"
      ).run()
    })()
  },
}

// Convertit les entiers SQLite 0/1 en booléens pour le renderer
function boolifyRule(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    hasDeuce: row.hasDeuce === 1,
    goldenPoint: row.goldenPoint === 1,
    isCustom: row.isCustom === 1,
  }
}
