import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth';
import { APP_NAME } from '@/lib/brand';
import './globals.css';

export const metadata: Metadata = {
  title: `${APP_NAME} — Education Operating System`,
  description: 'The single source of truth for the academy.',
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
