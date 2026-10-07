export const VISITOR_IDLE_MS = 30 * 60 * 1000;
export const TRACKING_VISITOR_MAX_MS = 8 * 60 * 60 * 1000;
export function visitorSubject(scope, digest, startedAt) {
 if (!['tracking', 'capacity'].includes(scope) || !/^[a-f0-9]{64}$/.test(digest) || !Number.isSafeInteger(startedAt) || startedAt < 0) throw new Error('INVALID_VISITOR_SESSION');
 return `mobile-visitor:${scope}:${digest}:${startedAt}`;
}
export function parseVisitorSession(payload, scope, now = Date.now()) {
 if (!['tracking', 'capacity'].includes(scope)) return null;
 const match = String(payload?.sub || '').match(/^mobile-visitor:(tracking|capacity):([a-f0-9]{64}):(\d+)$/);
 if (!match || match[1] !== scope) return null;
 const startedAt = Number(match[3]), expiresAt = Number(payload.exp) * 1000;
 if (!Number.isSafeInteger(startedAt) || startedAt > now || !Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + VISITOR_IDLE_MS + 1000 || (scope === 'tracking' && expiresAt > startedAt + TRACKING_VISITOR_MAX_MS)) return null;
 return { scope, digest: match[2], startedAt, expiresAt };
}
export function visitorSessionSeconds(scope, startedAt, now = Date.now()) {
 if (!['tracking', 'capacity'].includes(scope) || !Number.isSafeInteger(startedAt) || startedAt > now) return 0;
 return Math.max(0, Math.floor(Math.min(VISITOR_IDLE_MS, scope === 'tracking' ? startedAt + TRACKING_VISITOR_MAX_MS - now : VISITOR_IDLE_MS) / 1000));
}
export function visitorBearer(header) {
 if (typeof header !== 'string' || header.length > 2048) return null;
 return header.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/)?.[1] || null;
}
