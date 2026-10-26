import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: '#0B7A47',
        'brand-dark': '#086138',
        'brand-ink': '#0A4F30',
        'brand-tint': '#E7F4EC',
        pepper: '#F26A1B',
        ink: '#15171A',
        'ink-2': '#5B6168',
        line: '#E6E8EB',
        surface: '#F3F4F2',
        canvas: '#F6F7F5',
        photo: '#EDE6DA',
        warn: '#8A4B08',
        'warn-tint': '#FDF0E1',
        danger: '#B42318',
        star: '#F5A524',
      },
      fontFamily: {
        heading: ['Bricolage Grotesque', 'system-ui', 'sans-serif'],
        body: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '16px',
        chip: '9999px',
      },
      height: {
        'btn': '56px',
        'btn-sm': '44px',
      },
      keyframes: {
        'splash-logo': {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '70%': { transform: 'scale(1.06)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'splash-text': {
          '0%, 30%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'splash-dot': {
          '0%, 50%': { transform: 'scale(0)', opacity: '0' },
          '80%': { transform: 'scale(1.4)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'splash-logo': 'splash-logo 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'splash-text': 'splash-text 0.6s ease-out 0.55s both',
        'splash-dot': 'splash-dot 0.5s ease-out 0.65s both',
      },
    },
  },
  plugins: [],
}

export default config
