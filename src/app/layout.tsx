import type { Metadata } from 'next';
import './globals.css';

export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: { default: 'Loadgistic', template: '%s | Loadgistic' },
  description: 'B2B road freight connecting businesses looking for capacity with fleet transporters and self-managed drivers looking for demand.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Loadgistic',
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
  themeColor: '#1769e0'
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
