/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark theme colors (matching existing HTML report)
        dark: {
          bg: '#1a1a2e',
          surface: '#16213e',
          border: '#0f3460',
          hover: '#1f4068',
        },
        accent: {
          primary: '#e94560',
          secondary: '#00d9ff',
          success: '#4ade80',
          warning: '#fbbf24',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
