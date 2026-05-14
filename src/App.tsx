import { lazy, Suspense } from 'react'
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

const DevUI = lazy(() => import('./pages/DevUI').then((m) => ({ default: m.DevUI })))

export function App() {
  return (
    <HashRouter>
      <div className="flex flex-col w-full h-full">
        <Topbar />
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
        <Ticker />
      </div>
    </HashRouter>
  )
}
