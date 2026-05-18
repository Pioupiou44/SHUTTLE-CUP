import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { autoUpdater } from 'electron-updater'
import { initDb } from './db/queries'
import { registerDbHandlers } from './db/handlers'

const isDev = !app.isPackaged

// Ouvre une nouvelle fenêtre d'affichage (standalone) sur le hash donné
// Validation : uniquement des hash de routage valides (segments alphanum, /, -, _, =, ?)
const SAFE_HASH_RE = /^[a-zA-Z0-9\-_/=?&%]+$/
ipcMain.handle('open-new-window', async (_event, hash: string) => {
  if (typeof hash !== 'string' || !SAFE_HASH_RE.test(hash)) return
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    title: 'ShuttleCup — Affichage',
  })
  if (isDev) {
    await win.loadURL(`http://localhost:5173/#${hash}`)
  } else {
    await win.loadFile(path.join(__dirname, '../dist/index.html'), { hash })
  }
})

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#000A1F',
    frame: true,
    title: 'ShuttleDesk',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  try {
    initDb()
    registerDbHandlers(ipcMain)
  } catch (err) {
    console.error('Erreur initialisation base de données:', err)
  }

  createWindow()

  // ── Mise à jour automatique (prod uniquement) ──────────────────────────────
  if (!isDev) {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-available', (info) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('update:available', info.version)
    })

    autoUpdater.on('update-downloaded', (info) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('update:downloaded', info.version)
    })

    autoUpdater.on('error', (err) => {
      // Silencieux en prod — pas de popup d'erreur gênant
      console.error('[auto-update]', err.message)
    })

    // Vérifie 5s après le démarrage (laisse le temps à la fenêtre de s'afficher)
    setTimeout(() => { void autoUpdater.checkForUpdates() }, 5000)
  }

  // Installe la mise à jour quand l'utilisateur clique sur "Redémarrer"
  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
