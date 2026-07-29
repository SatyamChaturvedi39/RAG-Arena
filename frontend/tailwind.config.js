/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0C3547',
        accent: '#1A6B8A',
        signal1: '#2E86AB',
        signal2: '#A23B72',
        parametric: '#E6A817',
        vector: '#1A6B8A',
        vectorless: '#2D6A4F',
        surface: '#F7F9FB',
        border: '#D4DCE4',
        text: '#1C2B3A',
        muted: '#5E7387',
        bg: '#F0F4F7',
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
