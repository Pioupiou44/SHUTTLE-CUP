-- Migration 001 : ajout des disciplines (catégories) sur les tournois et matchs
ALTER TABLE tournaments ADD COLUMN categories TEXT NOT NULL DEFAULT '[]';
ALTER TABLE matches ADD COLUMN category TEXT;
