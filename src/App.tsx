import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="font-condensed font-bold uppercase text-3xl text-white tracking-widest">{title}</h1>
      <p className="font-sans text-light-grey/60 text-sm mt-2">Disponible en Phase 2</p>
    </div>
  )
}

const DevUI = lazy(() => import('./pages/DevUI').then((m) => ({ default: m.DevUI })))

export function App() {
  return (
    <HashRouter>
      <div className="flex w-full h-full">
        <Sidebar />
        <main className="flex-1 overflow-y-auto scrollbar-dark bg-dark-navy">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/players" element={<PlaceholderPage title="Joueurs" />} />
            <Route path="/tournaments" element={<PlaceholderPage title="Tournois" />} />
            <Route path="/settings" element={<PlaceholderPage title="Paramètres" />} />
            <Route
              path="/dev-ui"
              element={
                <Suspense fallback={<div className="p-8 text-white font-condensed">Chargement…</div>}>
                  <DevUI />
                </Suspense>
              }
            />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}
