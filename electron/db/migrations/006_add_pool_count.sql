-- Ajoute le nombre de groupes (poules) dans les tournois
ALTER TABLE tournaments ADD COLUMN poolCount INTEGER NOT NULL DEFAULT 2;
