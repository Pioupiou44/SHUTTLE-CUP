/**
 * Configuration Vitest séparée — évite de charger les plugins Electron de vite.config.ts
 * lors de l'exécution des tests unitaires.
 */

import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Ignore les fichiers AppleDouble macOS (._*) créés sur les volumes externes
    exclude: ['**/._*', '**/node_modules/**', '**/dist/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
