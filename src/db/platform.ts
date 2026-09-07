// Bootstrap plateforme — détecte l'environnement d'exécution avant le
// premier rendu React et installe le bon backend `window.db` :
//   - Electron : window.db est fourni par le preload (contextBridge)
//   - Android  : adaptateur @capacitor-community/sqlite (Capacitor)
//
// Les stores Zustand et les pages continuent d'appeler `window.db.*` à
// l'identique — aucune modification côté consommateurs.

import type { DbApi } from '@/types/ipc'
import { capacitorDbAdapter } from '@/db/capacitor-db-adapter'

export function isNativePlatform(): boolean {
  // @capacitor/core pose window.Capacitor PARTOUT (même en web/Electron) —
  // mais sans propriété `platform`. La seule API fiable : isNativePlatform(),
  // true uniquement sur device natif (Android/iOS), false en web/Electron.
  // NB : un ancien check `Capacitor?.platform !== 'web'` était BUGGÉ :
  // sous Electron platform est undefined → undefined !== 'web' → true →
  // tentative d'écraser window.db (lecture seule via contextBridge) →
  // TypeError → page blanche en prod desktop.
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return typeof window !== 'undefined' && cap?.isNativePlatform?.() === true
}

/**
 * À appeler AVANT le premier rendu React (main.tsx).
 * Installe window.db selon la plateforme :
 * - web/Electron → noop (le preload expose déjà window.db)
 * - Android → adaptateur SQLite Capacitor (sans init préalable : lazy au premier appel)
 */
export function setupPlatformDb(): void {
  if (!isNativePlatform()) return
  try {
    ;(window as { db?: DbApi }).db = capacitorDbAdapter
  } catch {
    // window.db est déjà exposé (contextBridge en lecture seule) → contexte
    // Electron/web : on garde l'API du preload, rien à faire. Un crash ici
    // empêcherait React de démarrer (page blanche en prod).
  }
}