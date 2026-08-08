/** @type {import('next').NextConfig} */
const scriptPolicy = process.env.NODE_ENV !== 'production'
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: 'standalone',
  poweredByHeader: false,
  async redirects() {
    return [
      {source:'/app/loads/:path*',destination:'/capacity',permanent:false},
      {source:'/app/shipments/:path*',destination:'/app/provider-shipments',permanent:false},
      {source:'/app/network',destination:'/capacity',permanent:false},
      {source:'/app/providers/:path*',destination:'/providers',permanent:false},
      {source:'/app/capacity/:path*',destination:'/capacity',permanent:false},
      {source:'/companies/:path*',destination:'/providers',permanent:false}
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org; style-src 'self' 'unsafe-inline'; ${scriptPolicy}; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
          }
        ]
      }
    ];
  }
};
export default nextConfig;
