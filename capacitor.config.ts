import type { CapacitorConfig } from '@capacitor/cli'

// Configuration Capacitor — ShuttleCup Android
// webDir = sortie du build `vite build -c vite.config.android.ts`
const config: CapacitorConfig = {
  appId: 'fr.alexisandcom.shuttlecup',
  appName: 'ShuttleCup',
  webDir: 'dist-android',
  android: {
    allowMixedContent: false,
    // Android 15+ (targetSdk 35) impose le edge-to-edge : sans ça, le WebView
    // glisse sous la barre de statut. 'auto' ajuste les marges du WebView
    // aux insets système (barre de notification en haut incluse).
    adjustMarginsForEdgeToEdge: 'auto',
  },
}

export default config