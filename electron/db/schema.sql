PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Joueurs (base globale, indépendante des tournois)
CREATE TABLE IF NOT EXISTS players (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  firstName TEXT NOT NULL,
  lastName  TEXT NOT NULL,
  pseudo    TEXT,
  gender    TEXT CHECK(gender IN ('M', 'F', 'X')) NOT NULL DEFAULT 'M',
  level     TEXT NOT NULL DEFAULT 'Intermédiaire',
  status    TEXT CHECK(status IN ('active', 'inactive')) NOT NULL DEFAULT 'active',
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Règles de scoring (prédéfinies + custom utilisateur)
CREATE TABLE IF NOT EXISTS scoring_rules (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL UNIQUE,
  setsToWin    INTEGER NOT NULL DEFAULT 2,
  pointsPerSet INTEGER NOT NULL DEFAULT 21,
  hasDeuce     INTEGER NOT NULL DEFAULT 1,
  maxScore     INTEGER NOT NULL DEFAULT 30,
  goldenPoint  INTEGER NOT NULL DEFAULT 0,
  isCustom     INTEGER NOT NULL DEFAULT 0
);

-- Tournois
CREATE TABLE IF NOT EXISTS tournaments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  date          TEXT NOT NULL,
  location      TEXT,
  courtCount    INTEGER NOT NULL DEFAULT 4,
  logoPath      TEXT,
  format        TEXT CHECK(format IN ('round-robin', 'knockout', 'double-elimination', 'pool+knockout', 'americano', 'swiss', 'king-of-court')) NOT NULL DEFAULT 'round-robin',
  status        TEXT CHECK(status IN ('draft', 'active', 'completed', 'archived')) NOT NULL DEFAULT 'draft',
  scoringRuleId INTEGER REFERENCES scoring_rules(id),
  createdAt     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Joueurs inscrits à un tournoi (liaison many-to-many)
CREATE TABLE IF NOT EXISTS tournament_players (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tournamentId INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  playerId     INTEGER NOT NULL REFERENCES players(id),
  seed         INTEGER,
  status       TEXT CHECK(status IN ('active', 'withdrawn', 'forfeit')) NOT NULL DEFAULT 'active',
  UNIQUE(tournamentId, playerId)
);

-- Matchs d'un tournoi
CREATE TABLE IF NOT EXISTS matches (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tournamentId INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round        INTEGER,
  courtNumber  INTEGER,
  scheduledAt  TEXT,
  status       TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'walkover', 'postponed')) NOT NULL DEFAULT 'pending',
  winnerId     INTEGER REFERENCES tournament_players(id),
  comment      TEXT
);

-- Participants à un match (côté A ou B, pour simple et double)
CREATE TABLE IF NOT EXISTS match_participants (
  matchId            INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  side               TEXT CHECK(side IN ('A', 'B')) NOT NULL,
  tournamentPlayerId INTEGER NOT NULL REFERENCES tournament_players(id),
  PRIMARY KEY (matchId, side, tournamentPlayerId)
);

-- Scores set par set pour chaque match
CREATE TABLE IF NOT EXISTS match_scores (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  matchId   INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  setNumber INTEGER NOT NULL,
  scoreA    INTEGER NOT NULL DEFAULT 0,
  scoreB    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(matchId, setNumber)
);

-- Suivi des migrations appliquées
CREATE TABLE IF NOT EXISTS _migrations (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL UNIQUE,
  appliedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Données initiales : règles de scoring officielles
INSERT OR IGNORE INTO scoring_rules (name, setsToWin, pointsPerSet, hasDeuce, maxScore, goldenPoint, isCustom)
VALUES
  ('BWF Standard 3×21', 2, 21, 1, 30, 0, 0),
  ('BWF 3×15 (à partir de 2027)', 2, 15, 1, 21, 1, 0),
  ('Set unique 21 points', 1, 21, 1, 30, 0, 0),
  ('3×15 classique', 2, 15, 0, 15, 1, 0),
  ('5×11 (expérimental)', 3, 11, 1, 15, 0, 0);
