import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { Topbar } from './components/Topbar'
import { MobileNav } from './components/MobileNav'
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
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {/* Desktop ≥1024px : Topbar horizontale. En dessous (tablette portrait,
          mobiles) : navigation verticale via MobileNav ci-dessous. */}
      <div className="flex flex-col w-full h-full">
        {!isStandalone && (
          <div className="hidden lg:block">
            <Topbar />
          </div>
        )}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar compacte <1024px : navigation verticale gauche
              (max-lg = tout écran < 1024px : tablette portrait 753px, mobiles) */}
          {!isStandalone && (
            <div className="hidden max-lg:flex">
              <MobileNav />
            </div>
          )}
          <main className="flex-1 min-w-0 overflow-y-auto scrollbar-light bg-bg flex flex-col">
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
        </div>
        {!isStandalone && <Ticker />}
      </div>
    </HashRouter>
  )
}
