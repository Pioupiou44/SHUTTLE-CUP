/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.shuttlecup.app',
  productName: 'ShuttleCup',
  copyright: 'ShuttleCup — Open Source',

  directories: {
    output: 'release',
    buildResources: 'assets',
  },

  files: [
    'dist/**',
    'dist-electron/**',
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

  win: {
    target: [
      { target: 'msix', arch: ['x64'] },
      { target: 'nsis', arch: ['x64'] },
    ],
    icon: 'assets/icon.ico',
  },

  msix: {
    applicationId: 'ShuttleCup',
    publisher: 'CN=ShuttleCup',
    publisherDisplayName: 'ShuttleCup',
    identityName: 'com.shuttlecup.app',
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'assets/icon.ico',
    uninstallerIcon: 'assets/icon.ico',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },

  // Compression maximale pour la distribution
  compression: 'maximum',
}
