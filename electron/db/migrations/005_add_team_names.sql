-- Stocke les noms des équipes en JSON (tableau de strings) pour supporter N équipes
-- Ex : '["Club Vertou","Club Saint-Mars","Club Nantes"]'
ALTER TABLE tournaments ADD COLUMN teamNames TEXT;
