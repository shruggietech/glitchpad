import localFont from 'next/font/local';

export const geist = localFont({
  src: [
    {
      path: '../public/fonts/Geist-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/Geist-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
  ],
  variable: '--font-geist',
  display: 'swap',
});

export const geistMono = localFont({
  src: '../public/fonts/GeistMono-Regular.woff2',
  weight: '400',
  style: 'normal',
  variable: '--font-geist-mono',
  display: 'swap',
});

export const spaceGrotesk = localFont({
  src: [
    {
      path: '../public/fonts/SpaceGrotesk-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../public/fonts/SpaceGrotesk-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-space-grotesk',
  display: 'swap',
});
