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
        // Fonds
        'bg':          '#fafaf7',   // papier — fond principal
        'bg-alt':      '#f1efe9',   // alternance tableaux
        'bg-strong':   '#e6e3da',   // zones de forte densité

        // Encre (texte)
        'ink':         '#0a0a0a',   // texte principal
        'ink-2':       '#4a4a4a',   // texte secondaire
        'ink-3':       '#8a8a82',   // métadonnées, placeholders

        // Lignes
        'line':        '#1a1a1a',   // bordures principales
        'line-soft':   '#cfcdc4',   // séparateurs internes

        // Identité
        'blue':        '#0047FF',   // équipe A, accents, liens
        'green':       '#00C24A',   // vert texte (lisible sur fond clair)
        'green-fluo':  '#00FF66',   // fills uniquement — victoires, équipe B

        // Sémantique
        'warn':        '#D97500',   // avertissements
        'red':         '#E60022',   // badge LIVE uniquement, erreurs critiques

        // Alias de compatibilité (ancien système — à supprimer progressivement)
        'electric-blue': '#0047FF',
        'fluo-green':    '#00FF66',
        'dark-navy':     '#0a0a0a',
        'mid-grey':      '#f1efe9',
        'light-grey':    '#fafaf7',
        'red-alert':     '#E60022',
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'Consolas', 'monospace'],
        // Alias obsolète — ne plus utiliser dans le nouveau code
        condensed: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Niveaux typographiques du design system
        'display-xl': ['280px', { lineHeight: '1', letterSpacing: '-0.07em' }],
        'display-l':  ['56px',  { lineHeight: '1', letterSpacing: '-0.04em' }],
        'display-m':  ['42px',  { lineHeight: '1', letterSpacing: '-0.03em' }],
        'display-s':  ['30px',  { lineHeight: '1.1', letterSpacing: '-0.02em' }],
      },
      keyframes: {
        ticker: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        ticker: 'ticker 20s linear infinite',
      },
    },
  },
  plugins: [
    // text-page-title : titre de page fluide — 42px desktop, 28px minimum sur
    // tablette portrait/mobile (l'app desktop restait énorme en paysage serré).
    function ({ addUtilities }: { addUtilities: (u: Record<string, Record<string, string>>) => void }) {
      addUtilities({
        '.text-page-title': {
          'font-size': 'clamp(28px, 4.5vw, 42px)',
          'line-height': '1',
          'letter-spacing': '-0.03em',
        },
      })
    },
  ],
} satisfies Config
