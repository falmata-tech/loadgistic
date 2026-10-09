// This runs before Router's query parser. Do not log incoming URLs: they may
// contain credentials even when rejected. No network or session mutation here.
const unavailable = '/link-unavailable';
const simpleRoutes = new Set(['/', '/account', '/account-details', '/account-settings', '/account-security',
  '/driver-photo', '/fleet', '/manage-capacity', '/shipments', '/network',
  '/regular-service', '/support', '/billing', '/documents', '/profile',
  '/featured', '/visitor-tracking', '/arrange-transport', '/about', '/privacy', '/delete-account', '/review-access', '/link-unavailable']);
const recordRoutes = new Set(['/shipment-detail', '/shipment-manage', '/visitor-shipment', '/support-chat']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeNativeLink(path: unknown, development = false): string {
  if (typeof path !== 'string' || path.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(path)) return unavailable;
  if (!path) return '/';
  try {
    // Built-in decoding throws in bounded time instead of invoking the dependency's
    // recursive malformed-UTF8 recovery. Validate before URLSearchParams repairs it.
    decodeURIComponent(path);
    const relative = path.startsWith('/') && !path.startsWith('//');
    const url = new URL(path, 'https://loadgistic.com');
    if (url.username || url.password || url.hash) return unavailable;
    if (development && url.protocol === 'exp+loadgistic:' && url.hostname === 'expo-development-client') {
      if (url.port || (url.pathname && url.pathname !== '/') || [...url.searchParams.keys()].join() !== 'url') return unavailable;
      const metro = new URL(url.searchParams.get('url') || '');
      return metro.protocol === 'http:' && ['127.0.0.1', 'localhost', '10.0.2.2'].includes(metro.hostname)
        && /^808[1-9]$/.test(metro.port) && !metro.username && !metro.password && !metro.search && !metro.hash
        && metro.pathname === '/' ? '/' : unavailable;
    }
    let route: string;
    if (relative) route = url.pathname;
    else if (url.protocol === 'loadgistic:' && !url.port) route = url.host ? `/${url.host}${url.pathname}` : url.pathname;
    else if (url.protocol === 'https:' && ['loadgistic.com', 'www.loadgistic.com'].includes(url.hostname) && !url.port) route = url.pathname;
    else return unavailable;
    route = route.replace(/\/$/, '') || '/';
    const entries = [...url.searchParams.entries()];
    if (entries.some(([key, value]) => /[\u0000-\u001f\u007f]/.test(key + value))) return unavailable;
    const params = new URLSearchParams();
    if (route === '/transporter') {
      if (entries.length !== 1 || entries[0][0] !== 'handle' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$/.test(entries[0][1])) return unavailable;
      params.set('handle', entries[0][1]);
    } else if (recordRoutes.has(route)) {
      if (entries.length !== 1 || entries[0][0] !== 'id' || !uuid.test(entries[0][1])) return unavailable;
      params.set('id', entries[0][1]);
    } else if (route === '/' && entries.length === 1 && entries[0][0] === 'q') {
      if (entries[0][1].length > 120) return unavailable;
      params.set('q', entries[0][1]);
    } else if (!simpleRoutes.has(route) || entries.length) return unavailable;
    // Returning a relative path avoids custom-scheme extraction's extra decoding.
    return route + (params.size ? `?${params.toString()}` : '');
  } catch { return unavailable; }
}
