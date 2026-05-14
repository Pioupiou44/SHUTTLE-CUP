# ShuttleCup

Application de bureau pour la gestion complète de tournois de badminton en club.

**Stack** : Electron 30 · React 18 · TypeScript strict · Vite · Zustand · better-sqlite3 · Tailwind CSS

---

## Sommaire

1. [Présentation](#présentation)
2. [Prérequis](#prérequis)
3. [Installation](#installation)
4. [Commandes](#commandes)
5. [Architecture du projet](#architecture-du-projet)
6. [Base de données](#base-de-données)
7. [IPC – communication main ↔ renderer](#ipc--communication-main--renderer)
8. [Types métier](#types-métier)
9. [State management (Zustand)](#state-management-zustand)
10. [Design system](#design-system)
11. [Routing](#routing)
12. [Modes de tournoi](#modes-de-tournoi)
13. [Mode interclub (rencontres par équipes)](#mode-interclub-rencontres-par-équipes)
14. [Raccourcis clavier – mode arbitrage](#raccourcis-clavier--mode-arbitrage)
15. [Packaging & distribution](#packaging--distribution)
16. [Phases de développement](#phases-de-développement)
17. [Conventions de code](#conventions-de-code)

---

## Présentation

ShuttleCup est une application Electron destinée aux organisateurs et arbitres de clubs de badminton (public cible : 40 ans+, peu à l'aise avec l'informatique). Elle fonctionne entièrement hors-ligne, stocke ses données dans une base SQLite locale et ne nécessite aucun serveur.

**Fonctionnalités implémentées :**

- Registre global des joueurs (CRUD, niveaux, genres, clubs, classement ELO, numéro de licence)
- Wizard de création de tournoi en 6 étapes
- Génération automatique du planning selon 7 formats
- Mode interclub (rencontres par équipes, round-robin entre N équipes)
- Attribution des joueurs aux équipes avec auto-assignment par club
- Composition des paires de doubles (drag & drop + tirage au sort)
- Vue planning avec permutation de matchs
- Vue arbitrage avec saisie de score en temps réel
- Raccourcis clavier pour l'arbitrage
- Topbar navigation + Ticker scores live

---

## Prérequis

| Outil | Version minimale |
|-------|-----------------|
| Node.js | **20** (via nvm recommandé) |
| npm | 10+ |
| macOS / Windows | — |

> **Important** : Ne pas utiliser Node 18 ou 22 — better-sqlite3 doit être compilé avec la même version Node qu'Electron. Node 20 est la version validée.

---

## Installation

```bash
# 1. Activer Node 20
export NVM_DIR="$HOME/.nvm" && . "/opt/homebrew/opt/nvm/nvm.sh" && nvm use 20

# 2. Cloner le dépôt
git clone https://github.com/votre-org/shuttlecup.git
cd shuttlecup

# 3. Installer les dépendances (compile automatiquement better-sqlite3)
npm install
```

Si `better-sqlite3` échoue à la compilation (après un changement de version Node/Electron) :

```bash
npm run rebuild-natives
```

---

## Commandes

```bash
# Serveur de développement (Vite + Electron avec live reload)
npm run dev

# Build complet (TypeScript renderer + Vite + TypeScript electron)
npm run build

# Build seul du process main Electron
npm run build:electron

# Recompiler better-sqlite3 après changement Node/Electron
npm run rebuild-natives
```

---

## Architecture du projet

```
shuttlecup/
├── electron/                    # Process principal Electron (Node.js)
│   ├── main.ts                  # BrowserWindow, sécurité contextIsolation
│   ├── preload.ts               # Bridge IPC typé → window.db
│   └── db/
│       ├── schema.sql           # Schéma SQLite + données initiales
│       ├── queries.ts           # Requêtes better-sqlite3, organisées par entité
│       ├── handlers.ts          # ipcMain.handle() pour chaque canal
│       └── migrations/
│           ├── runner.ts        # Runner .sql trié, tracé dans _migrations
│           ├── 001_add_categories.sql
│           ├── 002_add_club_elo_number.sql
│           ├── 003_seed_test_players.sql
│           ├── 004_add_team_mode.sql
│           ├── 005_add_team_names.sql
│           └── 006_add_pool_count.sql
│
├── src/                         # Process renderer (React, Vite)
│   ├── App.tsx                  # Router + layout principal
│   ├── index.css                # Tokens CSS + reset
│   ├── main.tsx                 # Point d'entrée React
│   │
│   ├── types/
│   │   ├── domain.ts            # Interfaces et types métier
│   │   └── ipc.ts               # Déclaration window.db (typings IPC)
│   │
│   ├── store/
│   │   ├── playersStore.ts      # Zustand – joueurs
│   │   ├── tournamentsStore.ts  # Zustand – tournois
│   │   └── rulesStore.ts        # Zustand – règles de scoring
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx        # Page d'accueil
│   │   ├── PlayersPage.tsx      # Liste et gestion des joueurs
│   │   ├── TournamentsPage.tsx  # Liste des tournois
│   │   ├── TournamentDetail.tsx # Détail tournoi + planning + arbitrage
│   │   ├── TournamentWizard.tsx # Wizard création tournoi (6 étapes)
│   │   ├── RefereeView.tsx      # Vue plein écran arbitrage
│   │   ├── SettingsPage.tsx     # Paramètres application
│   │   ├── PrintView.tsx        # Vue impression
│   │   └── DevUI.tsx            # Catalogue composants (dev uniquement)
│   │
│   ├── components/
│   │   ├── Topbar.tsx           # Navigation horizontale haut de page
│   │   ├── Ticker.tsx           # Bandeau bas scores live
│   │   ├── Sidebar.tsx          # Navigation latérale (si activée)
│   │   └── ui/
│   │       ├── Badge.tsx
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       ├── Select.tsx
│   │       ├── Table.tsx
│   │       ├── Tag.tsx
│   │       └── index.ts
│   │
│   ├── engine/                  # Logique pure (sans React, testable Vitest)
│   │   └── generators/
│   │       └── interclub.ts     # Générateur interclub (singles SH/SD)
│   │
│   └── lib/
│       └── utils.ts             # cn() (clsx + tailwind-merge)
│
├── public/
│   └── fonts/                   # Inter + JetBrains Mono (locaux)
│
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.electron.json
└── electron-builder.config.js
```

---

## Base de données

SQLite via `better-sqlite3`. Fichier stocké dans le répertoire userData Electron (`app.getPath('userData')/shuttlecup.db`).

**Pragmas actifs** :

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
```

### Schéma

| Table | Rôle |
|-------|------|
| `players` | Registre global des joueurs (indépendant des tournois) |
| `scoring_rules` | Règles de scoring (prédéfinies + custom utilisateur) |
| `tournaments` | Données maîtres d'un tournoi |
| `tournament_players` | Liaison M2M joueurs ↔ tournois, avec `teamSide` pour le mode interclub |
| `matches` | Matchs d'un tournoi |
| `match_participants` | Côtés A/B d'un match (simple et double) |
| `match_scores` | Scores set par set |
| `_migrations` | Trace des migrations déjà appliquées |

### Colonnes notables (ajoutées par migrations)

| Colonne | Table | Migration | Description |
|---------|-------|-----------|-------------|
| `categories` | `tournaments` | 001 | JSON array `["SH","DX",…]` |
| `club` | `players` | 002 | Nom du club |
| `elo` | `players` | 002 | Classement ELO |
| `playerNumber` | `players` | 002 | Numéro de licence |
| `teamMode` | `tournaments` | 004 | `0` = individuel, `1` = interclub |
| `teamSide` | `tournament_players` | 004 | `'A'` `'B'` `'C'` … (équipe) |
| `teamAName` `teamBName` | `tournaments` | 005 | Noms des 2 premières équipes (legacy) |
| `teamNames` | `tournaments` | 005 | JSON array des noms d'équipes |
| `poolCount` | `tournaments` | 006 | Nombre de poules (format pool+knockout) |

### Ajouter une migration

Créer un fichier `electron/db/migrations/NNN_description.sql` (NNN incrémental, ex : `007_mon_ajout.sql`). Le runner l'applique automatiquement au démarrage si non déjà tracé dans `_migrations`.

---

## IPC – communication main ↔ renderer

Le renderer n'a **jamais** accès direct à Node.js. Tout passe par `window.db` (exposé via `contextBridge` dans `preload.ts`).

**Format des canaux** : `db:{entité}:{action}` — ex. `db:getPlayers`, `db:setMatchScore`

### Ajouter un canal IPC

1. Écrire la requête SQL dans `electron/db/queries.ts`
2. Déclarer `ipcMain.handle('db:...')` dans `electron/db/handlers.ts`
3. Ajouter la signature dans `window.db` dans `src/types/ipc.ts`
4. Appeler via `window.db.{action}()` dans le store Zustand correspondant

### Canaux disponibles (principaux)

| Canal | Description |
|-------|-------------|
| `db:getPlayers` | Liste tous les joueurs actifs |
| `db:createPlayer` | Crée un joueur |
| `db:updatePlayer` | Met à jour un joueur |
| `db:deletePlayer` | Supprime un joueur |
| `db:getTournaments` | Liste tous les tournois |
| `db:createTournament` | Crée un tournoi |
| `db:updateTournament` | Met à jour les champs autorisés d'un tournoi |
| `db:deleteTournament` | Supprime un tournoi et ses données |
| `db:getTournamentPlayers` | Joueurs inscrits à un tournoi (avec jointure) |
| `db:addPlayerToTournament` | Inscrit un joueur |
| `db:removePlayerFromTournament` | Désinscrit un joueur |
| `db:updateTournamentPlayer` | Met à jour `teamSide`, `seed`, etc. |
| `db:getMatches` | Matchs d'un tournoi (avec participants et scores) |
| `db:createMatch` | Crée un match simple (1v1) |
| `db:createMatchWithTeams` | Crée un match double (2v2) |
| `db:createPlaceholderMatch` | Crée un match placeholder (bracket) |
| `db:updateMatchStatus` | Met à jour le statut d'un match |
| `db:setMatchScore` | Enregistre le score d'un set |
| `db:advanceWinner` | Avance le vainqueur dans le bracket |
| `db:swapMatchSides` | Échange les côtés A/B d'un match |
| `db:clearMatchesForTournament` | Supprime tous les matchs (réinitialisation) |
| `db:getScoringRules` | Liste les règles de scoring |

---

## Types métier

Définis dans `src/types/domain.ts` :

```typescript
type Gender = 'M' | 'F' | 'X'          // M=Homme, F=Femme, X=Non-binaire
type PlayerStatus = 'active' | 'inactive'
type MatchCategory = 'SH' | 'SD' | 'DH' | 'DD' | 'DX'
type TournamentFormat =
  | 'round-robin'         // Poules (tous contre tous)
  | 'knockout'            // Élimination directe
  | 'double-elimination'  // Double élimination
  | 'pool+knockout'       // Poules + tableau final
  | 'americano'           // Américano (partenaires rotatifs)
  | 'swiss'               // Système suisse
  | 'king-of-court'       // Roi du court
type TournamentStatus = 'draft' | 'active' | 'completed' | 'archived'
type MatchStatus = 'pending' | 'in_progress' | 'completed' | 'walkover' | 'postponed'
```

Utilitaire : `playerDisplayName(p)` → retourne le pseudo ou `"Prénom NOM"`.

---

## State management (Zustand)

Un store par entité principale :

| Store | Fichier | États exposés |
|-------|---------|---------------|
| `usePlayersStore` | `store/playersStore.ts` | `players`, `isLoading`, `error`, CRUD |
| `useTournamentsStore` | `store/tournamentsStore.ts` | `tournaments`, `isLoading`, `error`, CRUD |
| `useRulesStore` | `store/rulesStore.ts` | `rules`, `isLoading`, `error`, CRUD |

**Pattern** : mise à jour optimiste + appel IPC asynchrone.

```typescript
// Exemple d'appel depuis un composant
const { players, fetchPlayers, createPlayer } = usePlayersStore()

useEffect(() => { void fetchPlayers() }, [fetchPlayers])
```

---

## Design system

**Identité** : _Broadcast sport sur fond papier_ — fond blanc-cassé, typographie massive, angles droits, sans ombre.

### Tokens de couleur

| Classe Tailwind | Valeur | Usage |
|----------------|--------|-------|
| `bg` | `#fafaf7` | Fond principal (papier) |
| `bg-alt` | `#f1efe9` | Alternance lignes tableaux |
| `bg-strong` | `#e6e3da` | Zones de forte densité |
| `ink` | `#0a0a0a` | Texte principal, bordures |
| `ink-2` | `#4a4a4a` | Texte secondaire |
| `ink-3` | `#8a8a82` | Métadonnées, placeholders |
| `line` | `#1a1a1a` | Bordures principales (1.5–2px) |
| `line-soft` | `#cfcdc4` | Séparateurs internes |
| `blue` | `#0047FF` | Équipe A, accents, liens |
| `green` | `#00C24A` | Texte vert (lisible sur fond blanc) |
| `green-fluo` | `#00FF66` | Fills uniquement (jamais pour du texte) |
| `warn` | `#D97500` | Avertissements |
| `red` | `#E60022` | Badge LIVE, erreurs critiques |

> **Règle stricte** : `green-fluo` = fills uniquement, jamais en couleur de texte.

### Typographie

Polices locales dans `public/fonts/` :
- **Inter** (400 / 500 / 600 / 700 / 800 / 900)
- **JetBrains Mono Bold** (scores, codes, labels mono)

| Usage | Classes Tailwind |
|-------|-----------------|
| Titres de pages | `text-[42px] font-black tracking-[-0.03em] uppercase` |
| Noms joueurs arbitrage | `text-[30px] font-black tracking-[-0.02em]` |
| Scores géants | `text-[56px] font-black tracking-[-0.04em]` |
| Corps de texte | `text-[14px] font-normal` |
| Labels mono | `text-[11px] font-bold tracking-[0.08em] uppercase font-mono` |

### Géométrie

- `border-radius: 0` **partout, sans exception**
- Bordures : `1.5px` ou `2px` en couleur `line`
- Pas d'ombres, pas de gradients
- Grille 4px : `4 / 8 / 12 / 16 / 24 / 32 / 48`
- Hit targets minimum **44px**, boutons de score **56px+**

### Composants UI

| Composant | Description |
|-----------|-------------|
| `<Button variant="primary">` | Fond noir, texte vert-fluo, weight 900, uppercase |
| `<Button variant="secondary">` | Fond papier, bordure 1.5px noire, texte ink weight 800 |
| `<Tag color="SH\|SD\|DH\|DD\|DX\|M\|F">` | Pastille catégorie/genre colorée |
| `<Badge>` | Label court inline |
| `<Input>` | Champ texte, bordure noire 1.5px, pas de border-radius |
| `<Select>` | Sélecteur natif stylisé |
| `<Modal>` | Fenêtre modale avec overlay |
| `<Table>` | Header noir + texte vert-fluo, lignes alternées |
| `<Topbar>` | Navigation haut : logo + liens + badge LIVE + horloge |
| `<Ticker>` | Bandeau bas 30px, défilement des scores en cours |

### Couleurs des équipes interclub

8 slots définis (`TEAM_COLORS` dans `TournamentWizard.tsx`) :

| Index | Fond | Texte |
|-------|------|-------|
| A | `#0047FF` (bleu) | blanc |
| B | `#0a0a0a` (noir) | vert-fluo |
| C | `#D97500` (warn) | blanc |
| D | `#E60022` (rouge) | blanc |
| E | `#00C24A` (vert) | blanc |
| F | `#4a4a4a` (gris) | blanc |
| G | `#6600cc` (violet) | blanc |
| H | `#008080` (teal) | blanc |

---

## Routing

`HashRouter` avec lazy loading :

| Route | Page | Statut |
|-------|------|--------|
| `/` | Dashboard | ✅ |
| `/players` | Gestion des joueurs | ✅ |
| `/tournaments` | Liste des tournois | ✅ |
| `/tournaments/:id` | Détail + planning + arbitrage | ✅ |
| `/tournaments/new` | Wizard création | ✅ |
| `/settings` | Paramètres | ✅ |
| `/dev-ui` | Catalogue composants (dev) | ✅ |

### Navigation depuis le wizard

À la fin du wizard, `TournamentWizard` navigue vers `TournamentDetail` avec un state :

```typescript
navigate(`/tournaments/${id}`, {
  state: {
    doublesTeams: data.doublesTeams,  // paires doubles pré-configurées
    autoGenerate: true,               // déclenche la génération automatique
  },
})
```

`TournamentDetail` détecte `autoGenerate: true` et lance la génération du planning sans intervention manuelle.

---

## Modes de tournoi

### Tournoi individuel (défaut)

Génération automatique selon le format choisi au step 3 du wizard :

| Format | Générateur | Description |
|--------|-----------|-------------|
| `round-robin` | `generateRoundRobin` | Tous contre tous |
| `knockout` | `generateSingleElim` | Tableau élimination directe |
| `double-elimination` | `generateSingleElim` | Double élimination |
| `pool+knockout` | `generatePoolPlusKnockout` | Poules + tableau final (utilise `poolCount`) |
| `americano` | `generateAmericano` | Partenaires rotatifs |
| `swiss` | `generateRoundRobin` (fallback) | Système suisse |
| `king-of-court` | `generateRoundRobin` (fallback) | Roi du court |

### Mode interclub

Activé via `tournament.teamMode === 1`. Les joueurs sont répartis dans des équipes (A, B, C, D…). La génération crée un **round-robin entre toutes les équipes** :

- Pour **N équipes** → `N*(N-1)/2` confrontations (ex : 4 équipes = 6 rencontres)
- Chaque confrontation génère les matchs de toutes les catégories inscrites (SH, SD, DH, DD, DX)
- Singles : filtre par genre (SH = hommes, SD = femmes), appariement ELO décroissant
- Doubles : paires auto-générées par ELO intra-équipe (DH = 2 hommes, DD = 2 femmes, DX = 1H+1F)

---

## Raccourcis clavier – mode arbitrage

| Touche | Action |
|--------|--------|
| `A` ou `←` | +1 point équipe A |
| `B` ou `→` | +1 point équipe B |
| `Z` ou `Backspace` | Annuler le dernier point |
| `Espace` | Pause / reprise chrono |
| `Enter` | Valider le set |
| `Esc` | Fermer plein écran |

---

## Packaging & distribution

Configuré via `electron-builder.config.js` :

```bash
# Préparer le build
npm run build

# Packager (depuis le répertoire du projet)
npx electron-builder --win
```

Les artefacts sont générés dans `release/`.

**Cibles Windows** :
- `msix` (Microsoft Store / déploiement entreprise)
- `nsis` (installeur classique, avec choix du répertoire)

**Points importants** :
- `better-sqlite3` est décompressé hors de l'ASAR (`asarUnpack`) — obligatoire pour les modules natifs
- Les fichiers `.sql` (schema + migrations) sont copiés dans les `extraResources` du package

---

## Phases de développement

| Phase | Statut | Contenu |
|-------|--------|---------|
| **0 · Fondations** | ✅ | Schéma DB, IPC, stores, composants UI de base, design tokens |
| **1 · Layout** | ✅ | Topbar, Ticker, routing, Dashboard |
| **2 · Joueurs** | ✅ | CRUD joueurs, clubs, ELO, numéros de licence |
| **3 · Wizard tournoi** | ✅ | 6 étapes, mode interclub, composition doubles, auto-génération |
| **4 · Planning** | ✅ | Vue planning, permutation matchs, mode interclub round-robin N équipes |
| **5 · Arbitrage** | ✅ | Saisie score, raccourcis clavier, avancement bracket |
| **6 · Règles de scoring** | ⏳ | Éditeur de règles custom |
| **7 · Bracket visuel** | ⏳ | Vue tableau d'élimination interactive |
| **8 · Classements** | ⏳ | Classements poules + general |
| **9 · Impression** | ⏳ | Templates `@media print` |
| **10 · Archives** | ⏳ | Historique tournois, export CSV |
| **11 · Tests** | ⏳ | Vitest pour l'engine (générateurs, scoring, pairing) |
| **12 · Packaging** | ⏳ | MSIX + GitHub Actions CI/CD |

---

## Conventions de code

- **Commentaires en français**
- Pas de `any` TypeScript
- Pas de TODO dans le code (→ issues GitHub)
- Logique métier = fonctions pures dans `src/engine/`, jamais dans les composants
- Chaque générateur de tournoi respecte la signature `(players, config) => Match[]`
- Ne jamais utiliser le mot "erreur" dans l'UI → préférer "Attention", "Vérification", "À confirmer"
- Confirmations systématiques avant toute action destructive (suppression, réinitialisation)
- Mises à jour optimistes dans les stores Zustand : UI réactive immédiate, rollback en cas d'échec IPC
- `border-radius: 0` dans tous les composants visuels, sans exception

---

## Licence

ShuttleCup — Open Source. Voir [LICENSE](LICENSE).
