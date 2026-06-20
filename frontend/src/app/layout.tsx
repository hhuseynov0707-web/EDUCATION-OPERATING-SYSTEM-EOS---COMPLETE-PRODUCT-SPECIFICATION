import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/auth';
import { APP_NAME } from '@/lib/brand';
import './globals.css';

export const metadata: Metadata = {
  title: `${APP_NAME} — Education Operating System`,
  description: 'The single source of truth for the academy.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
