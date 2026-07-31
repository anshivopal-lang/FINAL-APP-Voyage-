import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';

import './globals.css';

/**
 * Self-hosted at build time by next/font — no runtime request to Google, and no
 * layout shift. Cormorant carries the display voice; Inter does the working text.
 */
const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Voyager — Holiday Management',
    template: '%s · Voyager',
  },
  description:
    'Plan, share and archive every holiday. A private membership platform for the trips that matter.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#08090c',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <div className="grain" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
