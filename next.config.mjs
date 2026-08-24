import { contentSecurityPolicy } from './src/lib/security-headers.js';

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: 'standalone',
  poweredByHeader: false,
  devIndicators: false,
  async redirects() {
    return [
      {source:'/app/loads/:path*',destination:'/',permanent:false},
      {source:'/app/shipments/:path*',destination:'/app/provider-shipments',permanent:false},
      {source:'/app/providers/:path*',destination:'/providers',permanent:false},
      {source:'/companies/:path*',destination:'/providers',permanent:false}
    ];
  },
  async rewrites() {
    return [{source:'/@:handle',destination:'/providers/:handle'}];
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" }
        ]
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy(process.env)
          }
        ]
      }
    ];
  }
};
export default nextConfig;
