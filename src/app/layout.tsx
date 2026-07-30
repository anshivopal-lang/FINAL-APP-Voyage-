import type { Metadata, Viewport } from 'next';

import './globals.css';
import { AppShell } from '@/components/AppShell';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: {
    default: 'Voyage — Holiday Management',
    template: '%s · Voyage',
  },
  description:
    'Plan, share and archive every holiday. A private membership platform for the trips that matter.',
};

export const viewport: Viewport = {
  themeColor: '#0a0c11',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
