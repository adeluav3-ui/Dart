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
        'brand-bright': '#3DDC84',
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
        heading: ['var(--font-heading)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
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
        'basket-slide': {
          '0%': { transform: 'translateX(-40px)', opacity: '0' },
          '60%': { opacity: '1' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'wheel-pop': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '70%': { transform: 'scale(1.3)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'splash-text': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'status-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'check-pop': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '65%': { transform: 'scale(1.3)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'flash-fade': {
          '0%': { opacity: '0.45' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        'basket-slide': 'basket-slide 0.55s ease-out forwards',
        'wheel-pop': 'wheel-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'splash-text': 'splash-text 0.45s ease-out both',
        'status-in': 'status-in 0.4s ease-out',
        'check-pop': 'check-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'flash-fade': 'flash-fade 0.8s ease-out forwards',
      },
    },
  },
  plugins: [],
}

export default config
