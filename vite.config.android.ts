import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Build Android : renderer uniquement, sans les plugins Electron.
// Sortie dans dist-android → consommé par `cap sync android`.
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist-android',
    emptyOutDir: true,
  },
})