import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'اتاق خبر فوتبال',
  description: 'سردبیر هوشمند فوتبال — Football Newsroom',
  manifest: '/manifest.webmanifest',
  applicationName: 'اتاق خبر فوتبال',
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
      <body>{children}</body>
    </html>
  );
}
