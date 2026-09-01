import './global.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { SkipLink } from '@/components/skip-link';
import { geist, geistMono, spaceGrotesk } from '@/lib/fonts';

const url = 'https://glitchpad.com';
const description =
  'A focused, local-first desktop and Android viewer and editor for common files.';

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: { default: 'Glitchpad', template: '%s | Glitchpad' },
  description,
  applicationName: 'Glitchpad',
  alternates: { canonical: '/' },
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    url,
    title: 'Glitchpad',
    description,
    siteName: 'Glitchpad',
    images: [{ url: '/social-preview.png', width: 1280, height: 640 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Glitchpad',
    description,
    images: ['/social-preview.png'],
  },
};

export const viewport: Viewport = {
  colorScheme: 'dark light',
  themeColor: '#0B0C0D',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable} ${spaceGrotesk.variable}`}
    >
      <body>
        <SkipLink />
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
