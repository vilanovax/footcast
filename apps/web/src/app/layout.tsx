import type { Metadata, Viewport } from 'next';
import { AppChrome } from '../components/AppChrome';
import './globals.css';

export const metadata: Metadata = {
  title: 'اتاق خبر فوتبال',
  description: 'سردبیر هوشمند فوتبال — Football Newsroom',
  manifest: '/manifest.webmanifest',
  applicationName: 'اتاق خبر فوتبال',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'اتاق خبر',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0B3D2E',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
