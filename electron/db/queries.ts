import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

let db: Database.Database

export function initDb(): void {
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'shuttledesk.db')

  // Chemin du schéma : relatif à __dirname en dev, dans resourcesPath en prod
  const schemaPath = app.isPackaged
    ? path.join(process.resourcesPath, 'db', 'schema.sql')
    : path.join(__dirname, 'schema.sql')

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const schema = fs.readFileSync(schemaPath, 'utf-8')
  db.exec(schema)

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

export const tournamentQueries = {
  getAll(): unknown[] {
    return getDb().prepare('SELECT * FROM tournaments ORDER BY date DESC').all()
  },

  create(t: {
    name: string
    date: string
    location?: string
    courtCount?: number
    logoPath?: string
    format: string
    scoringRuleId?: number
  }): unknown {
    const stmt = getDb().prepare(
      'INSERT INTO tournaments (name, date, location, courtCount, logoPath, format, scoringRuleId) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    const result = stmt.run(
      t.name, t.date, t.location ?? null, t.courtCount ?? 4,
      t.logoPath ?? null, t.format, t.scoringRuleId ?? null
    )
    return getDb().prepare('SELECT * FROM tournaments WHERE id = ?').get(result.lastInsertRowid)
  },

  update(id: number, data: Record<string, unknown>): unknown {
    const allowed = ['name', 'date', 'location', 'courtCount', 'logoPath', 'format', 'status', 'scoringRuleId']
    const fields = Object.keys(data).filter((k) => allowed.includes(k))
    if (fields.length === 0) return getDb().prepare('SELECT * FROM tournaments WHERE id = ?').get(id)

    const setClause = fields.map((f) => `${f} = ?`).join(', ')
    const values = fields.map((f) => data[f])
    getDb().prepare(`UPDATE tournaments SET ${setClause} WHERE id = ?`).run(...values, id)
    return getDb().prepare('SELECT * FROM tournaments WHERE id = ?').get(id)
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
    return getDb().prepare(`
      SELECT m.*,
        GROUP_CONCAT(CASE WHEN mp.side='A' THEN p.firstName || ' ' || p.lastName END) as teamA,
        GROUP_CONCAT(CASE WHEN mp.side='B' THEN p.firstName || ' ' || p.lastName END) as teamB
      FROM matches m
      LEFT JOIN match_participants mp ON mp.matchId = m.id
      LEFT JOIN tournament_players tp ON tp.id = mp.tournamentPlayerId
      LEFT JOIN players p ON p.id = tp.playerId
      WHERE m.tournamentId = ?
      GROUP BY m.id
      ORDER BY m.round, m.id
    `).all(tournamentId)
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
