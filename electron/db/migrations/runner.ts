import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT NOT NULL UNIQUE,
      appliedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const migrationsDir = app.isPackaged
    ? path.join(process.resourcesPath, 'db', 'migrations')
    : path.join(__dirname, '../electron/db/migrations')

  if (!fs.existsSync(migrationsDir)) return

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const applied = new Set(
    (db.prepare('SELECT name FROM _migrations').all() as { name: string }[]).map((r) => r.name)
  )

  for (const file of files) {
    if (!applied.has(file)) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
      db.exec(sql)
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file)
      console.log('Migration appliquée:', file)
    }
  }
}
