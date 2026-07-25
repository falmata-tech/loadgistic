function normalizedOrigin(value) {
  try {
    return value ? new URL(value).origin : null;
  } catch {
    return null;
  }
}

export function mutationOriginAllowed(headers, requestUrl) {
  const origin = normalizedOrigin(headers.get('origin'));
  if (!origin) return true;

  // Sec-Fetch-Site is a browser-controlled forbidden request header. It is a
  // reliable same-origin signal when development proxies rewrite Host/URL.
  if (headers.get('sec-fetch-site')?.toLowerCase() === 'same-origin') return true;

  const protocol = headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = headers.get('host')?.trim();
  const candidates = [normalizedOrigin(requestUrl)];
  if ((protocol === 'http' || protocol === 'https') && forwardedHost) candidates.push(normalizedOrigin(`${protocol}://${forwardedHost}`));
  if (host) candidates.push(normalizedOrigin(`${normalizedOrigin(requestUrl)?.startsWith('https:') ? 'https' : 'http'}://${host}`));
  return candidates.includes(origin);
}
