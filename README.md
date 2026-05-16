# ShuttleCup

Application de bureau pour la gestion complète de tournois de badminton en club.

**Stack** : Electron 30 · React 18 · TypeScript strict · Vite 5 · Zustand · better-sqlite3 · Tailwind CSS · `v1.0.1-beta`

🌐 **Site officiel** : [shuttle.cup.alexisandcom.fr](https://shuttle.cup.alexisandcom.fr)

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
- Génération automatique du planning selon 7 formats (dont King of Court et Swiss)
- Mode interclub (rencontres par équipes, round-robin entre N équipes)
- Attribution des joueurs aux équipes avec auto-assignment par club
- Composition des paires de doubles (drag & drop + tirage au sort)
- Vue planning avec permutation de matchs
- Vue arbitrage avec saisie de score en temps réel
- Raccourcis clavier pour l'arbitrage
- Classements : général (round-robin), américano (points cumulés), Swiss (Buchholz), King of Court (victoires terrain 1)
- Génération dynamique des rondes suivantes (Swiss et King of Court)
- Topbar navigation + Ticker scores live

---

## Prérequis

| Outil | Version minimale |
|-------|-----------------|
| Node.js | **20** (via nvm recommandé) |
| npm | 10+ |
| macOS / Windows / Linux | — |

> **Important** : Ne pas utiliser Node 18 ou 22 — better-sqlite3 doit être compilé avec la même version Node qu'Electron. Node 20 est la version validée.

---

## Installation

```bash
# 1. Activer Node 20
export NVM_DIR="$HOME/.nvm" && . "/opt/homebrew/opt/nvm/nvm.sh" && nvm use 20

# 2. Cloner le dépôt
git clone https://github.com/Pioupiou44/SHUTTLE-CUP.git
cd SHUTTLE-CUP

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

# Packaging (raccourcis — lancent un build avant la distribution)
npm run dist:mac      # macOS arm64 + x64 (nécessite les variables de notarisation)
npm run dist:win      # Windows NSIS x64
npm run dist:linux    # Linux AppImage + .deb x64
npm run dist:all      # Toutes les plateformes
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
│   │   ├── TournamentDetail.tsx # Détail tournoi + planning + arbitrage + classements
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
│   │   ├── index.ts             # Ré-exports centralisés de tout l'engine
│   │   ├── scoring.ts           # Calcul du vainqueur d'un set / match
│   │   ├── standings.ts         # Classements (général, américano, Swiss, King of Court)
│   │   └── generators/
│   │       ├── roundRobin.ts    # Tous contre tous
│   │       ├── singleElim.ts    # Tableau élimination directe (simple + double)
│   │       ├── americano.ts     # Américano (partenaires rotatifs)
│   │       ├── poolPlusKnockout.ts  # Poules + tableau final
│   │       ├── interclub.ts     # Interclub (round-robin entre équipes)
│   │       ├── kingOfCourt.ts   # King of Court (montée/descente de terrain)
│   │       └── swiss.ts         # Système suisse (appariement par niveau, Buchholz)
│   │
│   └── lib/
│       └── utils.ts             # cn() (clsx + tailwind-merge)
│
├── public/
│   └── fonts/                   # Inter + JetBrains Mono (locaux)
│
├── build/
│   └── notarize.js              # Hook afterSign : notarisation Apple avec notarytool
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.electron.json
└── electron-builder.config.js   # Config electron-builder (packaging multi-plateforme)
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

**Format des canaux internes** : `db:{action}` — ex. `db:getPlayers`, `db:setMatchScore`

### Ajouter un canal IPC

1. Écrire la requête SQL dans `electron/db/queries.ts`
2. Déclarer `ipcMain.handle('db:...')` dans `electron/db/handlers.ts`
3. Ajouter la signature dans l'interface `DbApi` dans `src/types/ipc.ts`
4. Appeler via `window.db.{action}()` dans le store Zustand correspondant

### API `window.db` (canaux disponibles)

| Méthode | Description |
|---------|-------------|
| `getPlayers()` | Liste tous les joueurs |
| `createPlayer(data)` | Crée un joueur |
| `updatePlayer(id, data)` | Met à jour un joueur |
| `deletePlayer(id)` | Supprime un joueur |
| `getTournaments()` | Liste tous les tournois |
| `createTournament(data)` | Crée un tournoi |
| `updateTournament(id, data)` | Met à jour les champs d'un tournoi |
| `deleteTournament(id)` | Supprime un tournoi et toutes ses données |
| `getScoringRules()` | Liste les règles de scoring |
| `createScoringRule(data)` | Crée une règle custom |
| `updateScoringRule(id, data)` | Met à jour une règle |
| `deleteScoringRule(id)` | Supprime une règle custom |
| `getTournamentPlayers(tournamentId)` | Joueurs inscrits à un tournoi (jointure players) |
| `addPlayerToTournament(tournamentId, playerId)` | Inscrit un joueur |
| `removePlayerFromTournament(tournamentPlayerId)` | Désinscrit un joueur |
| `setPlayerTeamSide(tournamentPlayerId, side)` | Affecte un joueur à une équipe (`'A'`, `'B'`, etc.) |
| `getMatches(tournamentId)` | Matchs d'un tournoi (participants + scores inclus) |
| `createMatch(data)` | Crée un match simple (1v1) |
| `createMatchWithTeams(data)` | Crée un match doubles (2v2) |
| `createPlaceholderMatch(data)` | Crée un match placeholder (bracket knockout) |
| `updateMatchStatus(matchId, status, winnerId?)` | Met à jour le statut d'un match |
| `setMatchScore(matchId, setNumber, scoreA, scoreB)` | Enregistre le score d'un set |
| `getMatchScores(matchId)` | Scores d'un match |
| `getAllMatchScores(tournamentId)` | Tous les scores d'un tournoi |
| `clearMatchScores(matchId)` | Supprime les scores d'un match |
| `advanceWinner(tournamentId, matchId, winnerId)` | Avance le vainqueur dans le bracket |
| `seedKnockoutMatches(seeds)` | Remplit le bracket knockout depuis les classements de poules |
| `swapMatchSides(m1, side1, m2, side2)` | Échange les côtés A/B entre deux matchs |
| `swapMatchPositions(m1, m2)` | Échange les positions de deux matchs |
| `updateMatchCourtNumber(matchId, courtNumber)` | Met à jour le numéro de terrain d'un match |
| `clearTournamentMatches(tournamentId)` | Supprime tous les matchs (réinitialisation planning) |
| `openNewWindow(hash)` | Ouvre une fenêtre secondaire (ex : vue arbitre) |
| `seedTestPlayers()` | Insère des joueurs de test (dev uniquement) |
| `clearAllData()` | Vide toute la base (dev uniquement) |

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
  | 'swiss'               // Système suisse (appariement Buchholz)
  | 'king-of-court'       // Roi du court (montée/descente de terrain)
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
| `green-fluo` | `#00FF66` | Fills uniquement — **jamais en couleur de texte** |
| `warn` | `#D97500` | Avertissements |
| `red` | `#E60022` | Badge LIVE, erreurs critiques |

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
| `<Tag color="SH\|SD\|DH\|DD\|DX\|M\|F\|X">` | Pastille catégorie/genre colorée |
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
| `/tournaments/:id` | Détail + planning + arbitrage + classements | ✅ |
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
| `swiss` | `generateSwissRound1` + `generateNextSwissRound` | Système suisse — ronde 1 générée, rondes suivantes via bouton |
| `king-of-court` | `generateKingOfCourtRound1` + `generateNextKingOfCourtRound` | Roi du court — vainqueurs montent, perdants descendent |

**Formats dynamiques (Swiss & King of Court)** : la ronde 1 est générée automatiquement. Quand tous les matchs d'une ronde sont terminés, un bouton "Ronde N ▶" apparaît dans l'onglet Planning pour générer la ronde suivante.

### Classements par format

| Format | Fonction engine | Critère principal |
|--------|----------------|-------------------|
| Tous formats (défaut) | `computeStandings` | Points de rang (victoires + ratio sets) |
| `americano` | `computeAmericanoStandings` | Points cumulés (somme de tous les points marqués) |
| `swiss` | `computeSwissStandings` | Points suisses (2/V, 1/D) + Buchholz |
| `king-of-court` | `computeKingOfCourtStandings` | Victoires sur le terrain 1 → total victoires → points |

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

Site de téléchargement : **[shuttle.cup.alexisandcom.fr](https://shuttle.cup.alexisandcom.fr)**

Config dans `electron-builder.config.js`.

```bash
# Préparer le build
export NVM_DIR="$HOME/.nvm" && . "/opt/homebrew/opt/nvm/nvm.sh" && nvm use 20
npm run build

# macOS — DMG arm64 (Apple Silicon) + x64 (Intel), signés + notarisés
npx electron-builder --mac --arm64 --x64

# Windows — installeur NSIS x64
npx electron-builder --win --x64

# Linux — AppImage + .deb x64
npx electron-builder --linux --x64
```

Les artefacts sont générés dans `release/` (ignoré par git) :

| Fichier | Plateforme |
|---------|------------|
| `ShuttleCup-{version}-arm64.dmg` | macOS Apple Silicon |
| `ShuttleCup-{version}.dmg` | macOS Intel x64 |
| `ShuttleCup Setup {version}.exe` | Windows x64 (NSIS) |
| `ShuttleCup-{version}.AppImage` | Linux x64 |
| `shuttlecup_{version}_amd64.deb` | Linux Debian/Ubuntu |

### Notarisation macOS

Le hook `build/notarize.js` (déclenché via `afterSign`) soumet l'`.app` à Apple avec `notarytool` avant la création du DMG. Variables d'environnement requises :

```bash
export APPLE_ID="votre@apple.id"
export APPLE_TEAM_ID="XXXXXXXXXX"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
```

> La clé `notarize: false` dans la config mac est **obligatoire** pour désactiver le mécanisme intégré de electron-builder v24 (qui crashe si la clé est absente).

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
| **6 · King of Court & Swiss** | ✅ | Générateurs dédiés, rondes dynamiques, classements Buchholz |
| **7 · Distribution v1.0.1-beta** | ✅ | macOS (arm64 + x64 notarisés), Windows NSIS, Linux AppImage + deb |
| **8 · Règles de scoring custom** | ⏳ | Éditeur de règles custom dans l'UI |
| **9 · Bracket visuel** | ⏳ | Vue tableau d'élimination interactive |
| **10 · Impression** | ⏳ | Templates `@media print` |
| **11 · Archives & export** | ⏳ | Historique tournois, export CSV |
| **12 · Tests** | ⏳ | Vitest pour l'engine (générateurs, scoring, standings) |

---

## Conventions de code

- **Commentaires en français**
- Pas de `any` TypeScript
- Pas de TODO dans le code (→ issues GitHub)
- Logique métier = fonctions pures dans `src/engine/`, jamais dans les composants
- Chaque générateur respecte la signature `(unitIds, config) => Omit<Match, 'id' | 'winnerId' | 'comment'>[]`
- Ne jamais utiliser le mot "erreur" dans l'UI → préférer "Attention", "Vérification", "À confirmer"
- Confirmations systématiques avant toute action destructive (suppression, réinitialisation)
- Mises à jour optimistes dans les stores Zustand : UI réactive immédiate, rollback en cas d'échec IPC
- `border-radius: 0` dans tous les composants visuels, sans exception

---

## Licence

ShuttleCup — Copyright © 2026 Alexis Priou. GNU AGPL v3. Voir [LICENSE](LICENSE).


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
├── build/
│   └── notarize.js              # Hook afterSign : notarisation Apple avec notarytool
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.electron.json
└── electron-builder.js          # Config electron-builder (packaging multi-plateforme)
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

Site de téléchargement : **[shuttle.cup.alexisandcom.fr](https://shuttle.cup.alexisandcom.fr)**

Config dans `electron-builder.js` (doit s'appeler `.js`, pas `.config.js` — requis par electron-builder v24).

```bash
# Préparer le build
export NVM_DIR="$HOME/.nvm" && . "/opt/homebrew/opt/nvm/nvm.sh" && nvm use 20
npm run build

# macOS — DMG arm64 (Apple Silicon) + x64 (Intel), signés + notarisés
npx electron-builder --mac --arm64 --x64

# Windows — installeur NSIS x64
npx electron-builder --win --x64

# Linux — AppImage + .deb x64
npx electron-builder --linux --x64
```

Les artefacts sont générés dans `release/` (ignoré par git) :

| Fichier | Plateforme |
|---------|------------|
| `ShuttleCup-{version}-arm64.dmg` | macOS Apple Silicon |
| `ShuttleCup-{version}.dmg` | macOS Intel x64 |
| `ShuttleCup Setup {version}.exe` | Windows x64 (NSIS) |
| `ShuttleCup-{version}.AppImage` | Linux x64 |
| `shuttlecup_{version}_amd64.deb` | Linux Debian/Ubuntu |

### Notarisation macOS

Le hook `build/notarize.js` (déclenché via `afterSign`) soumet l'`.app` à Apple avec `notarytool` avant la création du DMG. Variables d'environnement requises :

```bash
export APPLE_ID="votre@apple.id"
export APPLE_TEAM_ID="XXXXXXXXXX"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
```

> La clé `notarize: false` dans la config mac est **obligatoire** pour désactiver le mécanisme intégré de electron-builder v24 (qui crashe si la clé est absente).

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
| **6 · Distribution v1.0.1-beta** | ✅ | macOS (arm64 + x64 notarisés), Windows NSIS, Linux AppImage + deb |
| **7 · Règles de scoring** | ⏳ | Éditeur de règles custom |
| **8 · Bracket visuel** | ⏳ | Vue tableau d'élimination interactive |
| **9 · Classements** | ⏳ | Classements poules + general |
| **10 · Impression** | ⏳ | Templates `@media print` |
| **11 · Archives** | ⏳ | Historique tournois, export CSV |
| **12 · Tests** | ⏳ | Vitest pour l'engine (générateurs, scoring, pairing) |

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
