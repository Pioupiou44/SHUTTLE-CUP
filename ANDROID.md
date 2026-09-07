# ShuttleCup — Build Android (APK)

Portage de l'app Electron vers Android via **Capacitor 7**. La couche UI React
est réutilisée telle quelle ; la persistance passe par le plugin natif
`@capacitor-community/sqlite` (schéma et migrations SQL partagés avec Electron).

## Commandes

```bash
# Node 20 (convention projet)
export NVM_DIR="$HOME/.nvm" && . "/opt/homebrew/opt/nvm/nvm.sh" && nvm use 20

npm run build:android   # tsc + vite build → dist-android/
npm run cap:sync        # build + copie web + plugins dans android/
npm run apk:debug       # sync + gradle assembleDebug

# APK de sortie
release/ShuttleCup-<version>-android-debug.apk
# (aussi dans ~/.gradle-shuttlecup-builds/shuttlecup/app/outputs/apk/debug/)
```

## Installation sur la tablette

```bash
adb install -r release/ShuttleCup-1.0.3-android-release.apk # -r = conserve les données
```

Ou : copier l'APK sur la tablette → ouvrir le fichier → autoriser "Installer des
apps inconnues" (APK debug non signé Play Store). Le débogage USB n'exige pas
cette autorisation. **Ne jamais désinstaller avant une mise à jour** (perte de
données garantie).

## Architecture

```
src/db/
  sqlite-capacitor.ts    # Wrapper async run/query + init (schéma + migrations)
  capacitor-db-adapter.ts # Implémente DbApi (mêmes signatures que le preload Electron)
  platform.ts            # Détecte Android et installe window.db avant le rendu
  sql-raw.d.ts           # Déclarations pour les imports .sql?raw
src/lib/files.ts          # saveTextFile() — blob download (desktop) ou
                          # Filesystem Documents/ShuttleCup/ (Android, sans permission)
vite.config.android.ts    # Build web sans les plugins Electron
capacitor.config.ts       # appId fr.alexisandcom.shuttlecup, webDir dist-android
android/                  # Projet natif généré (cap add)
```

Le schéma (`electron/db/schema.sql`) et les migrations
(`electron/db/migrations/*.sql`) sont **partagés** entre Electron et Android :
une mise à jour du schéma s'applique aux deux plateformes. Côté Android, les
fichiers sont embarqués dans le bundle via les imports `?raw` de Vite — **toute
nouvelle migration doit être ajoutée à `MIGRATIONS` dans `sqlite-capacitor.ts`**.

## Permissions Android

Le manifest ne déclare que `android.permission.INTERNET` (minimum Capacitor).

- **Stockage** : aucune permission — SQLite est interne à l'app, l'export CSV/JSON
  écrit dans `Documents/ShuttleCup/` via Scoped Storage (Android 10+).
- **Écran** : `FLAG_KEEP_SCREEN_ON` dans `MainActivity` (pas de veille pendant
  l'arbitrage, sans permission WAKE_LOCK).

## Adaptations Android vs Electron

| Fonction | Electron | Android |
|---|---|---|
| `window.db` | preload IPC | adaptateur Capacitor SQLite (assigné au bootstrap) |
| Exports CSV/JSON | blob + `<a download>` | `Documents/ShuttleCup/` (Filesystem) |
| Fenêtre affichage secondaire | `openNewWindow` | no-op (pas de multi-fenêtres WebView) |
| Impression | `window.print()` | non supportée WebView — utiliser l'export CSV/PDF v2 |
| Raccourcis clavier arbitre | A/←, B/→, Z, Espace… | boutons tactiles (déjà présents dans l'UI) |
| Barres système | natives fenêtrées | insets appliqués dans MainActivity + 100dvh |
| Volets 60/40 | fixes dans le flux | `SidePanel` rétractable (overlay <1024px) |
| Impression | `window.print()` | pont natif `window.AndroidBridge.print()` →
  PrintManager système (imprimante ou PDF) — `window.print()` ne fait RIEN en WebView |
| Saisie score partielle | — | modale crayon : « Enregistrer (match en cours) » →
  statut `in_progress`, complétée seulement quand un vainqueur émerge |

## Pièges connus (volume exFAT)

Le projet est sur un volume exFAT : macOS y crée des fichiers AppleDouble
(`._*`) qui font échouer Gradle et `cap sync`.

1. Les répertoires de build sont **redirigés vers le disque interne** :
   `~/.gradle-shuttlecup-builds/` (voir `android/build.gradle`). Ne pas retirer.
2. Le JDK système est le 25 (trop récent pour Gradle 8.11) — `org.gradle.java.home`
   pointe sur le **JDK 21** dans `android/gradle.properties`.
3. En cas d'erreur `._xxx is not a directory` : nettoyer avec
   `find . -name "._*" -delete` (hors node_modules) puis relancer le build.
4. Après `rm -rf node_modules` ou `npm install`, repurger
   `node_modules/@capacitor/android/capacitor/build` si un build échoue.

## Volets latéraux rétractables (SidePanel)

Les pages à split 60/40 (Configuration, Assistant tournoi) utilisent `src/components/SidePanel.tsx` :

- **≥1024px** : volet dans le flux (40% de largeur, max 520px). Fermé → il sort du
  flux et la zone principale prend toute la largeur.
- **<1024px (portrait)** : fermé par défaut — la zone principale occupe tout ;
  ouverture via la poignée fixe à droite → volet en superposition animé
  (fixed, 420px max), refermable via le bouton ✕ de sa barre.
- **Transitions de largeur** : desktop→portrait referme, portrait→desktop
  rouvre (le WebView démarre parfois étroit — l'état converge).

## Sauvegarde complète

Page **Paramètres** → section Sauvegarde complète :

- **« Exporter toutes les données »** : génère `sauvegarde-complete-shuttlecup-<date>.json`
  dans `Documents/ShuttleCup/` (Android) ou téléchargement (desktop) — joueurs,
  règles, tournois avec inscriptions/matchs/scores.
- **« Restaurer une sauvegarde »** : sélectionne un fichier JSON exporté et
  restaure l'ensemble. Best-effort avec dédoublonnage : joueurs/règles existants
  (même nom) ignorés, tournois mal formés sautés, message récapitulatif du
  résultat. Implémenté sur les deux plateformes (`importFullBackup` — canal IPC
  Electron + adaptateur Capacitor).

À conserver avant mise à jour ou changement d'appareil. Round-trip complet
(export → effacement → restauration) testé empiriquement sur tablette.

## Responsive tablette

Validé empiriquement sur Galaxy Tab S7 FE (viewport 753px portrait / 1204px paysage) :

- **Boutons révélés au survol** (Archiver, Supprimer…) : `opacity-0 group-hover:opacity-100`
  est inopérant au tactile (pas de hover) — règle globale dans `index.css` :
  `@media (hover: none) { .opacity-0.group-hover\:opacity-100 { opacity: 1 } }`.
  Ne PAS utiliser un breakpoint lg: — la tablette en paysage fait >1024px.
- **≥1024px (lg:)** : Topbar horizontale desktop — inchangée.
- **<1024px (max-lg)** : `MobileNav` — sidebar verticale gauche 76px, icônes +
  labels, tokens design system (fond noir + carré vert-fluo). `App.tsx` gère la
  bascule en CSS pur : la rotation se répercute instantanément.
- **Titres de pages** : classe utilitaire `text-page-title` (plugin Tailwind,
  `tailwind.config.ts`) = `clamp(28px, 4.5vw, 42px)` — 8 pages migrées.
- **Grilles** : `grid-cols-2 lg:grid-cols-3` sur les stats du Dashboard.
- **Zoom texte Samsung** : la tablette appliquait 110% de zoom texte système →
  tout paraissait géant. Neutralisé via `getSettings().setTextZoom(100)` dans
  `MainActivity` (l'app a déjà sa typo massive propre).

Mesure CDP (outillage) : `scripts/measure-responsive.mjs` + debug distant :
`adb forward tcp:9222 localabstract:webview_devtools_remote_$(adb shell pidof
fr.alexisandcom.shuttlecup)` → `http://localhost:9222/json`.

## Mise à jour de l'app SANS perdre les données

**Toujours** `adb install -r` (ou réinstaller par-dessus sans désinstaller).
Une désinstallation efface `/data/data/...` (donc la base SQLite) — c'est le
comportement Android normal, pas un bug de l'app. Testé : `install -r` préserve
la base intacte (firstInstallTime ≠ lastUpdateTime).

## Pièges SQLite Android (corrigés — ne pas régresser)

- **advanceWinner / finale** : l'UPDATE `winnerId` doit être exécuté AVANT la
  recherche du match suivant — pour la finale il n'y a pas de round suivant et un
  `if (!targetMatch) return` prématuré empêchait TOTALEMENT l'enregistrement du
  champion (winnerId NULL → colonne Champion « À déterminer » à vie). Corrigé
  dans les DEUX implémentations (electron/db/queries.ts + adaptateur Capacitor).
- **Modale crayon — saisie effacée par le polling** (bug majeur) : le useEffect d'initialisation dépendait de `existingScores`, recréé à chaque refresh du polling 3s → les champs se vidaient toutes les 3 secondes pendant la frappe (impression de matchs « En cours » impossibles à saisir hors vue Live). Fix : n'initialiser QUE sur `isOpen` (une référence stable à l'ouverture).
- **Bouton de validation dynamique** dans la modale crayon : « Enregistrer le score »
  (match pas commencé) / « Enregistrer (match en cours) » (score partiel déjà en base) /
  « Valider le score » (vainqueur déterminé) — évite la confusion sur les matchs à venir.
- **Placeholders fantômes knockout** : en pool+knockout multi-catégories, une
  catégorie sous-effectif (ex : 2 hommes répartis en 2 poules de 1) ne produit
  AUCUN match de poule mais générait quand même les placeholders du bracket →
  matchs vides à vie qui **bloquent la clôture** (allMatchesDone jamais vrai).
  Fix : si `poolMatches.length === 0`, la catégorie est sautée avec
  avertissement (singles ET doubles). Pour un tournoi existant : alimenter ou
  supprimer le match fantôme manuellement.
- **Tableaux portrait** : les grilles à colonnes fixes (planning 760px,
  standings ~600px, joueurs ~770px) débordent en portrait (613px utiles) →
  envelopper chaque tableau dans `overflow-x-auto` + `min-w-max` (ou min-w
  explicite) pour un scroll horizontal propre, entête alignée.

- **PRAGMA interdits dans les batches** : le plugin exécute `execute()` dans une
  transaction ; `PRAGMA journal_mode = WAL` y lève une erreur et fait échouer
  TOUTE l'init de la base (base vide : aucune règle, aucune création possible).
  → `sanitizeSql()` dans `src/db/sqlite-capacitor.ts` retire les PRAGMA avant
  exécution. Le plugin active déjà `foreign_keys` à l'ouverture
  (`setForeignKeyConstraintsEnabled(true)`), et WAL n'apporte rien sur mobile.
- **SQL non portable** : `NULLS LAST` nécessite SQLite ≥ 3.30 (Android 11) →
  remplacé par `ORDER BY p.elo IS NULL, p.elo DESC`. L'UPSERT
  `ON CONFLICT DO UPDATE` nécessite SQLite ≥ 3.24 (Android 10) → remplacé par
  SELECT puis INSERT/UPDATE dans `setMatchScore`.
- **queryOne** : le plugin retourne TOUJOURS un tableau de lignes. Les
  résultats attendus à une ligne doivent passer par `queryOne()` (sinon le
  store reçoit `[player]` au lieu de `player` → crash d'affichage).
- **Barre de statut** : targetSdk 35 = edge-to-edge forcé (Android 15+) →
  `adjustMarginsForEdgeToEdge: 'auto'` dans `capacitor.config.ts` ET insets
  appliqués nativement dans `MainActivity.applySystemBarInsets()` — le handler
  Capacitor seul est posé trop tard (après le premier dispatch des insets) et
  peut ne jamais déclencher.
- **Hauteur portrait** : `100vh` dans un WebView Android inclut les barres
  système masquées par les insets dynamiques → layout trop court. `#root` passe
  à `100dvh` avec fallback `100vh` (`src/index.css`).
- **Thème** : `styles.xml` référence `@color/colorPrimary…` qui n'existaient
  pas → `colors.xml` définit la palette « Live Sport · Mode Clair » ; barres
  système couleur papier + `windowLightStatusBar` pour des icônes sombres.

## Icônes

```bash
node build/create-android-icons.js   # régénère les mipmaps depuis assets/icon.iconset/icon_512x512@2x.png
```

## Feuille de route (non inclus)

- **APK signé release** : générer un keystore (`keytool -genkey`), configurer
  `signingConfigs` dans `android/app/build.gradle` et `assembleRelease`.
- **AAB Play Store** : `./gradlew bundleRelease` (l'AAB est obligatoire pour le
  Play Store ; l'APK reste OK pour installation directe).
- **Écran de diffusion** : la fenêtre secondaire n'existe pas sur Android —
  envisager un mode "affichage plein écran permanent" ou un second appareil.
- **Impression** : génération PDF native (ex. `@capacitor-community/pdf` ou
  export CSV à imprimer depuis un PC).