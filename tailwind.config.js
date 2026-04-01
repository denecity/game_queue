/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0f1115',
          card: '#1a1d23',
          hover: '#20242c',
        },
        border: {
          DEFAULT: '#2a2d35',
          hover: '#4a4d58',
        },
        accent: {
          DEFAULT: '#4fd1c5',
          hover: '#38b2ac',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
