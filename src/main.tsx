import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { setupPlatformDb } from './db/platform'
import './index.css'

// Installe le backend window.db (adaptateur Capacitor sur Android) avant le premier rendu
setupPlatformDb()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
