import type { MetadataRoute } from 'next';
import { APP_NAME } from '@/lib/brand';

// Web app manifest — gives the installed/shortcut app a name, icon and theme.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — Education OS`,
    short_name: APP_NAME,
    description: 'Academy management — attendance, payments, progress.',
    start_url: '/',
    display: 'standalone',
    background_color: '#eef2f7',
    theme_color: '#0f172a',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
