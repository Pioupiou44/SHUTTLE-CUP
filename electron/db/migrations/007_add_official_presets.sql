-- Ajoute des presets officiels complémentaires pour les bases existantes
INSERT OR IGNORE INTO scoring_rules (name, setsToWin, pointsPerSet, hasDeuce, maxScore, goldenPoint, isCustom)
VALUES
  ('Format club 2×15 (rapide)', 2, 15, 1, 21, 1, 0),
  ('Set unique 15 points', 1, 15, 1, 21, 1, 0);
