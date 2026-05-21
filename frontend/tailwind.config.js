/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          900: '#09090b', // zinc-950
          800: '#18181b', // zinc-900
          700: '#27272a', // zinc-800
          600: '#3f3f46', // zinc-700
          500: '#52525b', // zinc-600
        },
        accent: {
          500: '#10b981', // emerald-500
          400: '#34d399', // emerald-400
          300: '#6ee7b7', // emerald-300
        },
        vector: {
          500: '#f59e0b', // amber-500
          400: '#fbbf24', // amber-400
          300: '#fcd34d', // amber-300
        },
        vectorless: {
          500: '#10b981', // emerald-500
          400: '#34d399', // emerald-400
          300: '#6ee7b7', // emerald-300
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
