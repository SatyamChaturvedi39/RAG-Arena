/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Dark AI tool aesthetic — slate base with indigo accents
        surface: {
          900: '#0f1117',
          800: '#161b27',
          700: '#1e2535',
          600: '#28304a',
        },
        accent: {
          500: '#6366f1',   // indigo
          400: '#818cf8',
          300: '#a5b4fc',
        },
        vector: {
          500: '#3b82f6',   // blue — vector RAG color
          400: '#60a5fa',
          100: '#dbeafe',
        },
        vectorless: {
          500: '#8b5cf6',   // purple — vectorless RAG color
          400: '#a78bfa',
          100: '#ede9fe',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
