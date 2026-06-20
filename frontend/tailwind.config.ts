import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(214.3 31.8% 91.4%)',
        background: 'hsl(0 0% 100%)',
        foreground: 'hsl(222.2 47.4% 11.2%)',
        muted: 'hsl(210 40% 96.1%)',
        'muted-foreground': 'hsl(215.4 16.3% 46.9%)',
        primary: 'hsl(222.2 47.4% 11.2%)',
        'primary-foreground': 'hsl(210 40% 98%)',
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
      },
    },
  },
  plugins: [],
};

export default config;
