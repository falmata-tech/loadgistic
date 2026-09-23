import {cookies} from 'next/headers';
import {LanguageProvider} from '@/components/localization';
import {LOCALE_COOKIE,supportedLocale} from '@/lib/i18n/core.js';
import {loadMessages,type Locale} from '@/lib/i18n/catalogs';
import type { Metadata } from 'next';
import './globals.css';
import {NativeFormFeedback} from '@/components/native-form-feedback';

export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: { default: 'Loadgistic', template: '%s | Loadgistic' },
  description: 'Share truck capacity with your network or the open market. Keep brokers, shippers and receivers informed with private shipment tracking across Ethiopia.',
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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale=supportedLocale((await cookies()).get(LOCALE_COOKIE)?.value) as Locale;
  const messages=await loadMessages(locale);
  return (
    <html lang={locale}>
      <body>
        <LanguageProvider locale={locale} messages={messages}>
          {children}
          <NativeFormFeedback/>
        </LanguageProvider>
        <script src="/register-sw.js" defer />
      </body>
    </html>
  );
}
