/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          900: '#080d16',
          800: '#0f1623',
          700: '#162030',
          600: '#1e2d42',
          500: '#2a3d58',
        },
        accent: {
          500: '#6366f1',
          400: '#818cf8',
          300: '#a5b4fc',
        },
        vector: {
          500: '#3b82f6',
          400: '#60a5fa',
          300: '#93c5fd',
        },
        vectorless: {
          500: '#8b5cf6',
          400: '#a78bfa',
          300: '#c4b5fd',
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
