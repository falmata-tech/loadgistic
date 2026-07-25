import type { Metadata } from 'next';
import './globals.css';

export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: { default: 'Loadgistic', template: '%s | Loadgistic' },
  description: 'B2B logistics connecting enterprise shippers and receivers with parcel delivery companies, transporters, and independent providers.',
  manifest: '/manifest.webmanifest'
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
