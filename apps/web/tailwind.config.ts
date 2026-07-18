import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        pitch: 'rgb(var(--bg-0) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        fog: 'rgb(var(--fog) / <alpha-value>)',
        chrome: 'rgb(var(--chrome) / <alpha-value>)',
        panel: 'rgb(var(--panel) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"Vazirmatn"', '"IBM Plex Sans Arabic"', 'sans-serif'],
        body: ['"Vazirmatn"', '"IBM Plex Sans Arabic"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
