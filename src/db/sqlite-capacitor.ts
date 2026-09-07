// Wrapper mince autour de @capacitor-community/sqlite exposant une API
// async `run` / `query` / `queryOne` — l'équivalent de better-sqlite3 pour Android.
// Le schéma et les migrations (fichiers .sql partagés avec Electron)
// sont embarqués dans le bundle via les imports `?raw` de Vite.

import { CapacitorSQLite } from '@capacitor-community/sqlite'
import schemaSql from '../../electron/db/schema.sql?raw'
import migration001 from '../../electron/db/migrations/001_add_categories.sql?raw'
import migration002 from '../../electron/db/migrations/002_add_club_elo_number.sql?raw'
import migration003 from '../../electron/db/migrations/003_seed_test_players.sql?raw'
import migration004 from '../../electron/db/migrations/004_add_team_mode.sql?raw'
import migration005 from '../../electron/db/migrations/005_add_team_names.sql?raw'
import migration006 from '../../electron/db/migrations/006_add_pool_count.sql?raw'
import migration007 from '../../electron/db/migrations/007_add_official_presets.sql?raw'

const DB_NAME = 'shuttlecup.db'

// Migrations embarquées — mêmes fichiers que le process Electron, mêmes noms pour le suivi _migrations
const MIGRATIONS: Array<[string, string]> = [
  ['001_add_categories.sql', migration001],
  ['002_add_club_elo_number.sql', migration002],
  ['003_seed_test_players.sql', migration003],
  ['004_add_team_mode.sql', migration004],
  ['005_add_team_names.sql', migration005],
  ['006_add_pool_count.sql', migration006],
  ['007_add_official_presets.sql', migration007],
]

let initPromise: Promise<void> | null = null

/**
 * Sanitise un script SQL pour le plugin Capacitor :
 * - retire les PRAGMA (journal_mode/foreign_keys) : le plugin exécute les batches
 *   dans une transaction → "cannot change into/out of wal mode from within a
 *   transaction". Le plugin active déjà foreign_keys à l'ouverture (setForeignKeyConstraintsEnabled).
 * - retire les lignes vides résiduelles.
 */
function sanitizeSql(script: string): string {
  return script
    .split('\n')
    .filter((line) => !/^\s*PRAGMA\s/i.test(line))
    .join('\n')
    .trim()
}

/** Exécute plusieurs statements SQL bruts (schéma, migrations) sans paramètres. */
async function runStatements(statements: string): Promise<void> {
  await CapacitorSQLite.execute({
    database: DB_NAME,
    statements: sanitizeSql(statements),
  })
}

/**
 * Prépare la base : connexion + schéma complet + migrations tracées dans _migrations.
 * Idempotent — appelé une seule fois au premier accès (lazy), partagé entre run/query.
 * NB : la migration 003 est vide (commentaire SQL uniquement) — `execute` la traite comme un no-op valide.
 */
async function initDatabase(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    // 1. Connexion à la base (non chiffrée, lecture-écriture)
    await CapacitorSQLite.createConnection({
      database: DB_NAME,
      encrypted: false,
      mode: 'no-encryption',
      version: 1,
    })
    await CapacitorSQLite.open({ database: DB_NAME, readonly: false })

    // 2. Schéma de base (tables + presets de règles — INSERT OR IGNORE), sans PRAGMA
    await runStatements(schemaSql)

    // 3. Migrations non encore appliquées, dans l'ordre
    const appliedResult = await CapacitorSQLite.query({
      database: DB_NAME,
      statement: 'SELECT name FROM _migrations',
      values: [],
    })
    const appliedNames = new Set(
      (appliedResult.values ?? []).map((r) => (r as { name: string }).name)
    )

    for (const [name, sql] of MIGRATIONS) {
      if (!appliedNames.has(name)) {
        await runStatements(sql)
        await CapacitorSQLite.run({
          database: DB_NAME,
          statement: 'INSERT INTO _migrations (name) VALUES (?)',
          values: [name],
        })
      }
    }
  })()
  return initPromise
}

/**
 * Requête SELECT → retourne le tableau des lignes typées.
 * T désigne le type d'UNE ligne (ex. query<Player>(...) → Player[]).
 */
export async function query<T = Record<string, unknown>>(
  statement: string,
  values: unknown[] = []
): Promise<T[]> {
  await initDatabase()
  const result = await CapacitorSQLite.query({
    database: DB_NAME,
    statement,
    values: values as never[],
  })
  return (result.values ?? []) as T[]
}

/**
 * Requête SELECT attendue à une seule ligne (get) → retourne la ligne ou undefined.
 * Évite les erreurs de décodage silencieuses du cast tableau→objet.
 */
export async function queryOne<T = Record<string, unknown>>(
  statement: string,
  values: unknown[] = []
): Promise<T | undefined> {
  const rows = await query<T>(statement, values)
  return rows[0]
}

/** INSERT / UPDATE / DELETE → retourne le lastInsertRowid et le nombre de lignes modifiées. */
export async function run(
  statement: string,
  values: unknown[] = []
): Promise<{ lastId: number; changes: number }> {
  await initDatabase()
  const result = await CapacitorSQLite.run({
    database: DB_NAME,
    statement,
    values: values as never[],
  })
  return {
    lastId: Number(result.changes?.lastId ?? 0),
    changes: Number(result.changes?.changes ?? 0),
  }
}