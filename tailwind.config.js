/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#07080c',
          900: '#0c0e14',
          850: '#11141c',
          800: '#171b25',
          700: '#222736',
          600: '#2f3547',
          500: '#4a5168',
          400: '#7a8199',
          300: '#a9afc4',
          200: '#d5d9e6',
          100: '#eef0f7',
        },
        pop: {
          violet: '#a78bfa',
          amber: '#fbbf24',
          sky: '#38bdf8',
          lime: '#a3e635',
          pink: '#f472b6',
          coral: '#fb7185',
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(.2,.9,.3,1.25)',
        out: 'cubic-bezier(.16,1,.3,1)',
      },
      keyframes: {
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'pop-in': { '0%': { opacity: 0, transform: 'scale(.92)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        wiggle: { '0%,100%': { transform: 'rotate(0)' }, '25%': { transform: 'rotate(-6deg)' }, '75%': { transform: 'rotate(6deg)' } },
        bob: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-3px)' } },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
      animation: {
        'sheet-up': 'sheet-up .38s cubic-bezier(.16,1,.3,1)',
        'pop-in': 'pop-in .28s cubic-bezier(.2,.9,.3,1.25)',
        'fade-in': 'fade-in .2s ease-out',
        wiggle: 'wiggle .4s ease-in-out',
        bob: 'bob 2.4s ease-in-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
}
