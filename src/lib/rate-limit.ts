type Bucket = { count: number; resetAt: number };
const globalBuckets = globalThis as typeof globalThis & { __loadgisticRateLimits?: Map<string, Bucket> };
const buckets = globalBuckets.__loadgisticRateLimits || new Map<string, Bucket>();
globalBuckets.__loadgisticRateLimits = buckets;

export function checkRateLimit(key: string, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  current.count += 1;
  if (current.count > limit) return { allowed: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
  return { allowed: true, retryAfterSeconds: 0 };
}

export function requestKey(request: { headers: { get(name: string): string | null } }, scope: string) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `${scope}:${forwarded || request.headers.get('x-real-ip') || 'local'}`;
}
