# ShuttleCup — Agent Instructions

Application Electron de gestion de tournois de badminton pour clubs. **Stack** : Electron 30 + React 18 + TypeScript strict + Vite + Zustand + better-sqlite3 + Tailwind CSS.

> **Nom** : ShuttleCup (shuttle = volant). Code source + UI en français.
> **Cible** : organisateurs / arbitres de club, 40 ans+, peu à l'aise avec l'info.

## Commandes essentielles

```bash
# Toujours utiliser Node 20 (nvm) :
export NVM_DIR="$HOME/.nvm" && . "/opt/homebrew/opt/nvm/nvm.sh" && nvm use 20

npm run dev             # Dev server (Vite + Electron live reload)
npm run build           # Build complet : tsc + vite build + tsc electron
npm run build:electron  # Build seul du process main Electron
npm run rebuild-natives # Recompiler better-sqlite3 après changement Node/Electron
```

> Pas de tests automatisés pour l'instant (Vitest prévu Phase 3).

## Architecture actuelle (Phase 1 ✅)

```
electron/
  main.ts          # BrowserWindow, sécurité contextIsolation
  preload.ts       # Bridge IPC typé → window.db
  db/
    schema.sql     # Schéma SQLite + données initiales
    queries.ts     # Requêtes better-sqlite3, par entité
    handlers.ts    # ipcMain.handle() pour chaque canal
    migrations/
      runner.ts    # Runner .sql trié, tracé dans _migrations

src/
  types/
    domain.ts      # Interfaces et types métier
    ipc.ts         # Déclaration window.db
  store/           # Zustand stores (un par entité)
  pages/           # Dashboard, DevUI, placeholders Phase 2
  components/
    ui/            # Badge, Button, Input, Modal, Select, Table, Tag
    Topbar.tsx     # Navigation horizontale haut de page
    Ticker.tsx     # Bandeau bas scores live
```

## Architecture cible (Phase 2+)

```
src/
  features/
    players/       # CRUD joueurs + import CSV
    rules/         # Présets BWF + éditeur custom
    tournaments/   # Création, état, archives
    matches/       # Arbitrage, scoring
    bracket/       # Poules / bracket / classement
    print/         # Templates @media print
  engine/          # Logique pure (sans React, testable Vitest)
    scoring.ts
    generators/    # roundRobin, singleElim, doubleElim, americano…
    pairing.ts
    standings.ts
  i18n/fr.json
```

## IPC : communication main ↔ renderer

**Règle** : le renderer n'a jamais accès direct à Node.js. Tout passe par `window.db`.

Format des canaux : `db:{entité}:{action}` — ex. `db:getPlayers`, `db:setMatchScore`

### Ajouter un canal IPC

1. Requête SQL dans `electron/db/queries.ts`
2. `ipcMain.handle('db:...')` dans `electron/db/handlers.ts`
3. Signature dans `window.db` dans `src/types/ipc.ts`
4. Appel via `window.db.{action}()` dans le store Zustand

## Base de données SQLite

**Pragmas** : `PRAGMA foreign_keys = ON`, `PRAGMA journal_mode = WAL`

| Table | Rôle |
|-------|------|
| `players` | Registre global des joueurs |
| `scoring_rules` | Règles BWF (5 intégrées) + custom |
| `tournaments` | Données maîtres d'un tournoi |
| `tournament_players` | M2M joueurs ↔ tournois |
| `matches` | Matchs d'un tournoi |
| `match_participants` | Côtés A/B |
| `match_scores` | Scores set par set |

**Migrations** : fichiers `001_description.sql` dans `electron/db/migrations/`, appliqués une seule fois.

## Types métier — [`src/types/domain.ts`](src/types/domain.ts)

```ts
type Gender = 'H' | 'F'                     // H/F uniquement (mixte = catégorie DX)
type PlayerStatus = 'active' | 'inactive'
type TournamentMode = 'ROUND_ROBIN' | 'SINGLE_ELIM' | 'DOUBLE_ELIM' |
                      'GROUPS_PLUS_FINAL' | 'AMERICANO' | 'KING_OF_COURT' | 'SWISS'
type MatchCategory = 'SH' | 'SD' | 'DH' | 'DD' | 'DX'
type TournamentStatus = 'DRAFT' | 'ONGOING' | 'PAUSED' | 'DONE'
type MatchStatus = 'PENDING' | 'LIVE' | 'DONE' | 'FORFEIT_A' | 'FORFEIT_B' | 'DRAW'
```

Utilitaire : `playerDisplayName(p)` → pseudo ou "{firstName} {lastName}".

## Règles de scoring (type `Rule`)

```ts
type Rule = {
  id: string; name: string; builtIn: boolean;
  pointsToWin: number;      // 21 / 15 / 11
  setsToWin: number;        // 2 (sur 3) ou 1 (set unique)
  minGap: number;           // 2 (standard)
  maxPoints: number | null; // 30 ou null
  serviceMode: 'rally' | 'classic';
  timeLimitMinutes?: number;
}
```

Présets livrés : `BWF 21pts`, `BWF 15pts`, `BWF 11pts`, `Set unique 21pts`.

## State management (Zustand)

- Stores : `usePlayersStore`, `useTournamentsStore`, `useRulesStore`, `useUiStore`
- Pattern : mise à jour optimiste + appel IPC async
- État : `{ data[], isLoading, error, fetchX(), createX(), updateX(), deleteX() }`

## Design system — « Live Sport · Mode Clair »

Identité **broadcast sport sur fond papier**. Fond blanc-cassé, typographie massive, angles droits.

### Tokens Tailwind / CSS custom properties

| Token Tailwind | CSS var | Valeur | Usage |
|---|---|---|---|
| `bg` | `--color-bg` | `#fafaf7` | Fond principal (papier) |
| `bg-alt` | `--color-bg-alt` | `#f1efe9` | Alternance tableaux |
| `bg-strong` | `--color-bg-strong` | `#e6e3da` | Zones de forte densité |
| `ink` | `--color-ink` | `#0a0a0a` | Texte principal, bordures |
| `ink-2` | `--color-ink-2` | `#4a4a4a` | Texte secondaire |
| `ink-3` | `--color-ink-3` | `#8a8a82` | Métadonnées, placeholders |
| `line` | `--color-line` | `#1a1a1a` | Bordures principales (1.5-2px) |
| `line-soft` | `--color-line-soft` | `#cfcdc4` | Séparateurs internes |
| `blue` | `--color-blue` | `#0047FF` | Équipe A, accents, liens |
| `green` | `--color-green` | `#00C24A` | Vert texte (lisible sur blanc) |
| `green-fluo` | `--color-green-fluo` | `#00FF66` | Fills, équipe B, victoires |
| `warn` | `--color-warn` | `#D97500` | Avertissements |
| `red` | `--color-red` | `#E60022` | Badge LIVE uniquement, erreurs critiques |

**Règle stricte** : `green-fluo` = fills uniquement, jamais pour du texte. Pour le texte vert, utiliser `green`.

### Typographie

Polices locales dans `public/fonts/` :
- `Inter` (Regular 400, Medium 500, SemiBold 600, Bold 700, ExtraBold 800, Black 900)
- `JetBrains Mono Bold` (scores, codes, labels mono)
- `Barlow Condensed` **obsolète** — ne plus utiliser

| Classe | Taille | Weight | Usage |
|---|---|---|---|
| `font-display` | Inter Black 900 | — | Titres de pages |
| `font-sans` | Inter 400-700 | — | Corps de texte |
| `font-mono` | JetBrains Mono 700 | — | Scores, labels techniques |

Niveaux typographiques :
- Titres de page : `text-[42px] font-black tracking-[-0.03em] uppercase`
- Noms joueurs arbitrage : `text-[30px] font-black tracking-[-0.02em]`
- Scores géants : `text-[56px] font-black tracking-[-0.04em]`
- Body : `text-[14px] font-normal`
- Labels mono : `text-[11px] font-bold tracking-[0.08em] uppercase font-mono`

### Géométrie

- `border-radius: 0` **partout, sans exception**
- Bordures : `1.5px` ou `2px` en `line`
- Pas d'ombres, pas de gradients
- Espacement : grille 4px (4 / 8 / 12 / 16 / 24 / 32 / 48)
- Hit targets min **44px**, boutons de score **56px+**

### Composants clés

| Composant | Description |
|---|---|
| `<Topbar>` | Bandeau haut : logo (carré noir + carré vert-fluo), navigation uppercase, sous-ligne bleue sur actif, badge LIVE rouge + horloge à droite |
| `<Ticker>` | Bandeau bas 30px, badge noir "SCORES LIVE", défilement, scores en mono bleu |
| `<Button variant="primary">` | Fond noir, texte vert-fluo, weight 900, uppercase, letter-spacing 0.05em |
| `<Button variant="secondary">` | Fond papier, bordure 1.5px noire, texte ink weight 800 |
| `<Tag color="H\|F\|SH\|SD\|DH\|DD\|DX">` | Pastille : H = fond bleu/blanc, F = fond vert-fluo/noir |
| `<StatBlock>` | Grand chiffre `display-l` + label mono dessous |
| `<DataTable>` | Header noir + texte vert-fluo, lignes alternées bg/bg-alt, séparateurs line-soft |
| `<Field>` | Label mono uppercase + input bordure noire 1.5px, pas de border-radius |
| `<Toggle>` | Boutons côte à côte, actif = fond noir + texte vert-fluo |

### Layouts type

- **Écrans admin** (joueurs, règles, archives) : Topbar + content + Ticker
- **Écrans setup** (création tournoi) : split 60/40 — formulaire | live preview
- **Mode arbitre** : header LIVE rouge + 3 colonnes (Équipe A bleu | Stats | Équipe B vert) + ribbon point-par-point

## Routing

HashRouter, lazy loading :

- `/` → Dashboard
- `/players` → Joueurs (Phase 2)
- `/tournaments` → Tournois (Phase 2)
- `/settings` → Paramètres (Phase 2)
- `/dev-ui` → DevUI (dev only)

## Raccourcis clavier (mode arbitrage)

| Touche | Action |
|---|---|
| `A` ou `←` | +1 point équipe A |
| `B` ou `→` | +1 point équipe B |
| `Z` ou `Backspace` | Annuler le dernier point |
| `Espace` | Pause / reprise chrono |
| `Enter` | Valider le set |
| `Esc` | Fermer plein écran |

## Phases de développement

| Phase | Statut | Contenu |
|---|---|---|
| **0 · Fondations** | ✅ | DB schema, IPC, stores, composants UI de base, design tokens |
| **1 · Layout** | ✅ | Topbar, Ticker, routing, Dashboard |
| **2 · Joueurs + Règles** | ⏳ | CRUD complets, import/export CSV |
| **3 · Engine** | ⏳ | Générateurs de tournoi + scoring + pairing + **Vitest** |
| **4 · Création tournoi** | ⏳ | Wizard avec live preview |
| **5 · Plan tournoi** | ⏳ | Vues poules, bracket, classement |
| **6 · Arbitrage** | ⏳ | Scoreboard + raccourcis + undo |
| **7 · Impression** | ⏳ | Templates `@media print` |
| **8 · Archives + Préférences** | ⏳ | Grande typo, raccourcis configurables |
| **9 · Packaging** | ⏳ | MSIX + GitHub Actions |

## Conventions de code

- Commentaires en **français**
- Pas de `any` TypeScript
- Pas de TODO dans le code (→ issues GitHub)
- Logique métier = fonctions pures dans `src/engine/`, jamais dans les composants
- Chaque générateur de tournoi = `(players, config, rule) => Match[]`
- Ne jamais utiliser "erreur" dans l'UI → "Attention", "Vérification", "À confirmer"
- Confirmations systématiques avant toute destruction
