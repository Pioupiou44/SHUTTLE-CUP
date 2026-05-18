/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'fr.alexisandcom.shuttlecup',
  productName: 'ShuttleCup',
  copyright: 'Copyright © 2026 Alexis Priou — GNU AGPL v3',

  directories: {
    output: 'release',
    buildResources: 'assets',
  },

  files: [
    'dist/**',
    'dist-electron/**',
    '!dist/**/*.map',
    '!dist-electron/**/*.map',
  ],

  // Décompresser les modules natifs — obligatoire pour better-sqlite3
  asarUnpack: [
    '**/node_modules/better-sqlite3/**',
    '**/node_modules/bindings/**',
  ],

  extraResources: [
    {
      from: 'electron/db/schema.sql',
      to: 'db/schema.sql',
    },
    {
      from: 'electron/db/migrations',
      to: 'db/migrations',
      filter: ['**/*.sql'],
    },
  ],

  // ─── macOS — DMG Apple Silicon (arm64) + Intel (x64) ───────────────────────
  // Notarisation : définir APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
  // Signature    : définir CSC_LINK (cert .p12 en base64) + CSC_KEY_PASSWORD
  mac: {
    target: [
      { target: 'dmg', arch: ['arm64'] },
      { target: 'dmg', arch: ['x64'] },
    ],
    icon: 'assets/icon.icns',
    category: 'public.app-category.sports',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'assets/entitlements.mac.plist',
    entitlementsInherit: 'assets/entitlements.mac.plist',
    // Désactive la notarisation intégrée v24 (notre hook afterSign s'en charge)
    notarize: false,
  },

  dmg: {
    title: 'ShuttleCup ${version}',
    icon: 'assets/icon.icns',
    sign: false,
    contents: [
      { x: 130, y: 220, type: 'file' },
      { x: 410, y: 220, type: 'link', path: '/Applications' },
    ],
    window: { width: 540, height: 380 },
  },

  // ─── Windows — installeur NSIS x64, sans signature ─────────────────────────
  // Pas de code signing requis (distribution gratuite / open source)
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },
    ],
    icon: 'assets/icon.ico',
    // Pas de signature : laisser ces propriétés absentes
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'assets/icon.ico',
    uninstallerIcon: 'assets/icon.ico',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'ShuttleCup',
  },

  // ─── Linux — AppImage + .deb x64 ───────────────────────────────────────────
  linux: {
    target: [
      { target: 'AppImage', arch: ['x64'] },
      { target: 'deb',      arch: ['x64'] },
    ],
    icon: 'assets/icons',
    category: 'Sports',
    maintainer: 'Alexis Priou <contact@alexisandcom.fr>',
    description: 'Gestionnaire de tournois de badminton pour clubs',
  },

  deb: {
    depends: ['libgtk-3-0', 'libnotify4', 'libnss3', 'libxss1', 'libxtst6', 'xdg-utils'],
  },

  // ─── Hook afterSign : notarise l'app macOS si les variables sont définies ──
  afterSign: 'build/notarize.js',

  // Compression maximale pour la distribution
  compression: 'maximum',

  // ─── Publication GitHub Releases — utilisé par electron-updater ────────────
  publish: {
    provider: 'github',
    owner: 'Pioupiou24',
    repo: 'SHUTTLE-CUP',
    releaseType: 'release',
  },
}
