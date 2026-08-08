import type { Metadata } from 'next';
import './globals.css';

export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: { default: 'Loadgistic', template: '%s | Loadgistic' },
  description: 'Public road-freight capacity discovery connecting Ethiopian producers and businesses with transport providers already operating trucks and routes.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Loadgistic',
  icons: {
    icon: [{ url: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }, { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { url: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
    shortcut: [{ url: '/favicon-32.png', sizes: '32x32', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Loadgistic'
  },
  formatDetection: { telephone: true }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0c2a43'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <script src="/register-sw.js" defer />
      </body>
    </html>
  );
}
