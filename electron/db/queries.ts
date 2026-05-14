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
    return getDb().prepare('SELECT * FROM players ORDER BY lastName, firstName').all()
  },

  create(p: {
    firstName: string
    lastName: string
    pseudo?: string
    gender: string
    level: string
    status?: string
  }): unknown {
    const stmt = getDb().prepare(
      'INSERT INTO players (firstName, lastName, pseudo, gender, level, status) VALUES (?, ?, ?, ?, ?, ?)'
    )
    const result = stmt.run(p.firstName, p.lastName, p.pseudo ?? null, p.gender, p.level, p.status ?? 'active')
    return getDb().prepare('SELECT * FROM players WHERE id = ?').get(result.lastInsertRowid)
  },

  update(id: number, data: Record<string, unknown>): unknown {
    const allowed = ['firstName', 'lastName', 'pseudo', 'gender', 'level', 'status']
    const fields = Object.keys(data).filter((k) => allowed.includes(k))
    if (fields.length === 0) return getDb().prepare('SELECT * FROM players WHERE id = ?').get(id)

    const setClause = fields.map((f) => `${f} = ?`).join(', ')
    const values = fields.map((f) => data[f])
    getDb().prepare(`UPDATE players SET ${setClause} WHERE id = ?`).run(...values, id)
    return getDb().prepare('SELECT * FROM players WHERE id = ?').get(id)
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
  return { ...row, categories }
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
    logoPath?: string
    format: string
    scoringRuleId?: number
    categories?: string[]
  }): unknown {
    const stmt = getDb().prepare(
      'INSERT INTO tournaments (name, date, location, courtCount, logoPath, format, scoringRuleId, categories) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    const result = stmt.run(
      t.name, t.date, t.location ?? null, t.courtCount ?? 4,
      t.logoPath ?? null, t.format, t.scoringRuleId ?? null,
      JSON.stringify(t.categories ?? [])
    )
    const row = getDb().prepare('SELECT * FROM tournaments WHERE id = ?').get(result.lastInsertRowid)
    return parseTournament(row as Record<string, unknown>)
  },

  update(id: number, data: Record<string, unknown>): unknown {
    const allowed = ['name', 'date', 'location', 'courtCount', 'logoPath', 'format', 'status', 'scoringRuleId', 'categories']
    const fields = Object.keys(data).filter((k) => allowed.includes(k))
    if (fields.length === 0) {
      const row = getDb().prepare('SELECT * FROM tournaments WHERE id = ?').get(id)
      return parseTournament(row as Record<string, unknown>)
    }

    const setClause = fields.map((f) => `${f} = ?`).join(', ')
    const values = fields.map((f) => f === 'categories' ? JSON.stringify(data[f]) : data[f])
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
}

// --- Matchs ---

export const matchQueries = {
  getAll(tournamentId: number): unknown[] {
    // Retourne les IDs joueurs dans teamA/teamB pour que l'engine puisse les identifier
    return getDb().prepare(`
      SELECT m.*,
        GROUP_CONCAT(CASE WHEN mp.side='A' THEN CAST(p.id AS TEXT) END) as teamA,
        GROUP_CONCAT(CASE WHEN mp.side='B' THEN CAST(p.id AS TEXT) END) as teamB
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
  }): unknown {
    // Insère le match
    const matchResult = getDb()
      .prepare('INSERT INTO matches (tournamentId, round, courtNumber, status, category) VALUES (?, ?, ?, ?, ?)')
      .run(match.tournamentId, match.round ?? null, match.courtNumber ?? null, 'pending', match.category ?? null)
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

    const tp = db.prepare(
      'SELECT id FROM tournament_players WHERE tournamentId = ? AND playerId = ?'
    ).get(tournamentId, winnerPlayerId) as { id: number } | undefined
    if (!tp) return

    const existing = db.prepare(
      'SELECT id FROM match_participants WHERE matchId = ? AND side = ?'
    ).get(targetMatch.id, side) as { id: number } | undefined

    if (existing) {
      db.prepare('UPDATE match_participants SET tournamentPlayerId = ? WHERE id = ?').run(tp.id, existing.id)
    } else {
      db.prepare('INSERT INTO match_participants (matchId, side, tournamentPlayerId) VALUES (?, ?, ?)').run(targetMatch.id, side, tp.id)
    }
  },
}

// --- Admin ---

export const adminQueries = {
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
