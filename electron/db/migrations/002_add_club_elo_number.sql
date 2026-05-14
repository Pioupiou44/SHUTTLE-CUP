-- Ajout du club, de l'ELO et du numéro de dossard aux joueurs
ALTER TABLE players ADD COLUMN club TEXT;
ALTER TABLE players ADD COLUMN elo INTEGER DEFAULT 1000;
ALTER TABLE players ADD COLUMN playerNumber INTEGER;
