import { NextRequest, NextResponse } from 'next/server.js';

export function redirectUrl(request: NextRequest, pathname: string) {
  const browserOrigin = request.headers.get('origin');
  // Mutation requests reach route handlers only after middleware validates
  // their Origin. Prefer that public browser origin because development
  // proxies may strip fetch metadata and rewrite every host header.
  if (browserOrigin) {
    try {
      const url = new URL(browserOrigin);
      if (url.protocol === 'http:' || url.protocol === 'https:') return new URL(pathname, url.origin);
    } catch {
      // Fall through to validated proxy/request headers.
    }
  }
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const requestHost = request.headers.get('host')?.trim();
  const host = forwardedHost || requestHost;
  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwardedProtocol === 'https' || forwardedProtocol === 'http'
    ? forwardedProtocol
    : request.nextUrl.protocol.replace(':', '');
  const safeOrigin = host && /^[a-zA-Z0-9.:[\]-]+$/.test(host)
    ? `${protocol}://${host}`
    : request.nextUrl.origin;
  return new URL(pathname, safeOrigin);
}

export function redirectWith(request: NextRequest, path: string, key: 'error' | 'success', value: string) {
  const url = redirectUrl(request, path);
  url.searchParams.set(key, value);
  return NextResponse.redirect(url, 303);
}

export function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export function checked(form: FormData, key: string) {
  return form.get(key) === 'on' || form.get(key) === 'true' || form.get(key) === '1';
}
