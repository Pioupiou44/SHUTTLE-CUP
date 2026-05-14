-- Données de test : 16 joueurs fictifs de clubs différents
-- 9 hommes, 7 femmes — niveaux variés
INSERT INTO players (firstName, lastName, gender, level, club, elo, status) VALUES
  ('Thomas',    'Dupont',    'M', 'Avancé',        'ST MARS',  1420, 'active'),
  ('Lucas',     'Moreau',    'M', 'Avancé',        'VERTOU',   1380, 'active'),
  ('Mathieu',   'Bernard',   'M', 'Intermédiaire', 'ST MARS',  1210, 'active'),
  ('Kevin',     'Leroy',     'M', 'Intermédiaire', 'NANTES',   1185, 'active'),
  ('Julien',    'Simon',     'M', 'Intermédiaire', 'REZÉ',     1160, 'active'),
  ('Romain',    'Laurent',   'M', 'Intermédiaire', 'VERTOU',   1140, 'active'),
  ('Antoine',   'Petit',     'M', 'Débutant',      'NANTES',    980, 'active'),
  ('Pierre',    'Garcia',    'M', 'Débutant',      'ST MARS',   950, 'active'),
  ('Nicolas',   'Martin',    'M', 'Débutant',      'REZÉ',      920, 'active'),
  ('Camille',   'Rousseau',  'F', 'Avancé',        'VERTOU',   1350, 'active'),
  ('Sophie',    'Girard',    'F', 'Avancé',        'NANTES',   1290, 'active'),
  ('Julie',     'Fontaine',  'F', 'Intermédiaire', 'ST MARS',  1180, 'active'),
  ('Marine',    'Leclerc',   'F', 'Intermédiaire', 'REZÉ',     1130, 'active'),
  ('Lucie',     'Bonnet',    'F', 'Intermédiaire', 'NANTES',   1100, 'active'),
  ('Emma',      'Chevalier', 'F', 'Débutant',      'VERTOU',    960, 'active'),
  ('Claire',    'Dubois',    'F', 'Débutant',      'ST MARS',   930, 'active');
