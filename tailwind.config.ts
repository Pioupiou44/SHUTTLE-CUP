import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Écrase TOUS les border-radius par défaut — aucun arrondi dans l'application
    borderRadius: {
      DEFAULT: '0',
      none: '0',
      sm: '0',
      md: '0',
      lg: '0',
      xl: '0',
      '2xl': '0',
      '3xl': '0',
      full: '0',
    },
    extend: {
      colors: {
        'electric-blue': '#0047FF',
        'fluo-green': '#39FF14',
        'dark-navy': '#000A1F',
        'mid-grey': '#1A1A2E',
        'light-grey': '#F0F0F0',
        'red-alert': '#FF1744',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        condensed: ['"Barlow Condensed"', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
