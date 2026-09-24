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

        // Slow photographic push-in for hero images on load
        kenburns: {
          from: { transform: 'scale(1.16)' },
          to: { transform: 'scale(1)' },
        },
        twinkle: {
          '0%, 100%': { opacity: '0.15', transform: 'scale(0.55) rotate(0deg)' },
          '50%': { opacity: '1', transform: 'scale(1) rotate(45deg)' },
        },
        drift: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '33%': { transform: 'translate3d(4%, -6%, 0) scale(1.08)' },
          '66%': { transform: 'translate3d(-5%, 4%, 0) scale(0.95)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'enter-up': {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'enter-down': {
          from: { opacity: '0', transform: 'translateY(-24px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'page-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'pulse-ring': {
          '0%': { opacity: '0.55', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(1.9)' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
        'scroll-cue': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(300%)' },
        },
      },
      animation: {
        'marquee-left': 'marquee-left 40s linear infinite',
        'marquee-right': 'marquee-right 40s linear infinite',
        kenburns: 'kenburns 2.8s cubic-bezier(0.22, 1, 0.36, 1) both',
        twinkle: 'twinkle 4.5s ease-in-out infinite',
        drift: 'drift 22s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        'spin-slow': 'spin 28s linear infinite',
        'spin-slower': 'spin 60s linear infinite',
        'enter-up': 'enter-up 1.1s cubic-bezier(0.22, 1, 0.36, 1) both',
        'enter-down': 'enter-down 1.1s cubic-bezier(0.22, 1, 0.36, 1) both',
        'page-in': 'page-in 0.8s ease-out both',
        'pulse-ring': 'pulse-ring 2.6s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        shimmer: 'shimmer 4s linear infinite',
        'scroll-cue': 'scroll-cue 2.2s cubic-bezier(0.65, 0, 0.35, 1) infinite',
      },
    },
  },
  plugins: [],
};
