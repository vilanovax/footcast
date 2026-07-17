import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        pitch: '#0B3D2E',
        accent: '#C6A15B',
        ink: '#12231C',
        fog: '#E7F0EB',
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
