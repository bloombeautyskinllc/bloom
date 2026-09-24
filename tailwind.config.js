/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FAF8F5',
        sand: '#F4EFEA',
        stone: '#E4DCD2',
        taupe: '#CDC2B4',
        latte: '#D9C7B5',
        bronze: '#725F4C',
        cocoa: '#31251B',
        ink: '#231B15',
        muted: '#5E4F41',
        accent: '#836855',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      maxWidth: {
        site: '1240px',
      },
      boxShadow: {
        soft: '0 30px 60px rgba(35, 27, 21, 0.14)',
      },
      keyframes: {
        'marquee-left': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        'marquee-right': {
          from: { transform: 'translateX(-50%)' },
          to: { transform: 'translateX(0)' },
        },
      },
      animation: {
        'marquee-left': 'marquee-left 40s linear infinite',
        'marquee-right': 'marquee-right 40s linear infinite',
      },
    },
  },
  plugins: [],
};
