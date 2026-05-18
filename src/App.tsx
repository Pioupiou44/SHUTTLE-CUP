import { lazy, Suspense, useEffect, useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { Topbar } from './components/Topbar'
import { Ticker } from './components/Ticker'
import { Dashboard } from './pages/Dashboard'
import { PlayersPage } from './pages/PlayersPage'
import { TournamentsPage } from './pages/TournamentsPage'
import { TournamentWizard } from './pages/TournamentWizard'
import { TournamentDetail } from './pages/TournamentDetail'
import { RefereeView } from './pages/RefereeView'
import { SettingsPage } from './pages/SettingsPage'
import { PrintView } from './pages/PrintView'

const DevUI = lazy(() => import('./pages/DevUI').then((m) => ({ default: m.DevUI })))

// Détecte le mode standalone depuis le hash de l'URL (ex : #/path?standalone=1)
// Doit être évalué AVANT le premier rendu React pour éviter un flash de Topbar
const isStandalone = window.location.hash.includes('standalone=1')

export function App() {
  const [updateState, setUpdateState] = useState<'idle' | 'available' | 'ready'>('idle')
  const [updateVersion, setUpdateVersion] = useState<string>('')

  useEffect(() => {
    if (!window.updater) return
    window.updater.onUpdateAvailable((version) => {
      setUpdateVersion(version)
      setUpdateState('available')
    })
    window.updater.onUpdateDownloaded((version) => {
      setUpdateVersion(version)
      setUpdateState('ready')
    })
  }, [])

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="flex flex-col w-full h-full">
        {!isStandalone && <Topbar />}
        {/* Bannière de mise à jour — visible uniquement en prod quand une MAJ est disponible */}
        {updateState !== 'idle' && !isStandalone && (
          <div className="flex items-center justify-between gap-4 px-5 py-2 bg-ink text-green-fluo
            font-sans text-[12px] font-bold tracking-[0.04em] uppercase shrink-0">
            <span>
              {updateState === 'available'
                ? `Mise à jour ${updateVersion} — téléchargement en cours…`
                : `Mise à jour ${updateVersion} prête — redémarrer pour l'installer`}
            </span>
            {updateState === 'ready' && (
              <button
                onClick={() => { void window.updater.install() }}
                className="px-3 py-1 bg-green-fluo text-ink font-black text-[11px] uppercase
                  tracking-[0.06em] hover:opacity-80 transition-opacity"
              >
                Redémarrer
              </button>
            )}
          </div>
        )}
        <main className="flex-1 overflow-y-auto scrollbar-light bg-bg flex flex-col">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/tournaments" element={<TournamentsPage />} />
            <Route path="/tournaments/new" element={<TournamentWizard />} />
            <Route path="/tournaments/:id" element={<TournamentDetail />} />
            <Route
              path="/tournaments/:id/match/:matchId"
              element={<RefereeView />}
            />
            <Route path="/tournaments/:id/print" element={<PrintView />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route
              path="/dev-ui"
              element={
                <Suspense fallback={<div className="p-8 text-ink font-sans">Chargement…</div>}>
                  <DevUI />
                </Suspense>
              }
            />
          </Routes>
        </main>
        {!isStandalone && <Ticker />}
      </div>
    </HashRouter>
  )
}
