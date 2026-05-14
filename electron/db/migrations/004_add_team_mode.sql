-- Mode équipes (interclub) : Club A vs Club B
-- teamMode = 0 : tournoi individuel standard (défaut)
-- teamMode = 1 : rencontre par équipes (interclub)
ALTER TABLE tournaments ADD COLUMN teamMode INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tournaments ADD COLUMN teamAName TEXT;
ALTER TABLE tournaments ADD COLUMN teamBName TEXT;

-- Côté de l'équipe pour chaque joueur inscrit
ALTER TABLE tournament_players ADD COLUMN teamSide TEXT;
