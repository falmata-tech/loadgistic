export type VisitorScope = 'tracking' | 'capacity';
export type VisitorGrant = { token: string; scope: VisitorScope; startedAt: number; expiresAt: number; lastActivityAt: number; renewedAt: number; clockOffsetMs: number };
type Port = { now: () => number; read: (scope: VisitorScope) => Promise<string | null>; write: (scope: VisitorScope, value: string) => Promise<void>; remove: (scope: VisitorScope) => Promise<void>; request: (path: string, options: { token?: string; body?: unknown; signal?: AbortSignal }) => Promise<unknown>; changed: () => void; storageError?: (scope: VisitorScope, message: string) => void };
const IDLE = 30 * 60000, MAX_TRACKING = 8 * 60 * 60000;
export function parseVisitorGrant(value: unknown, scope: VisitorScope, now: number): VisitorGrant {
 if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Verify your email to continue.');
 const item = value as Record<string, unknown>;
 const clockOffsetMs = item.clockOffsetMs === undefined ? 0 : item.clockOffsetMs;
 if (typeof clockOffsetMs !== 'number' || !Number.isSafeInteger(clockOffsetMs)) throw new Error('Verify your email to continue.');
 const serverNow = now + clockOffsetMs;
 if (item.scope !== scope || typeof item.token !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(item.token) || item.token.length > 2048 || typeof item.startedAt !== 'number' || !Number.isSafeInteger(item.startedAt) || item.startedAt < 0 || item.startedAt > serverNow || typeof item.expiresAt !== 'number' || !Number.isSafeInteger(item.expiresAt) || item.expiresAt <= serverNow || item.expiresAt > serverNow + IDLE + 1000 || scope === 'tracking' && item.expiresAt > item.startedAt + MAX_TRACKING) throw new Error('Verify your email to continue.');
 const lastActivityAt = item.lastActivityAt === undefined ? now : item.lastActivityAt;
 const renewedAt = item.renewedAt === undefined ? now : item.renewedAt;
 if (typeof renewedAt !== 'number' || !Number.isSafeInteger(renewedAt) || renewedAt < 0 || renewedAt > now) throw new Error('Verify your email to continue.');
 if (typeof lastActivityAt !== 'number' || !Number.isSafeInteger(lastActivityAt) || lastActivityAt < 0 || lastActivityAt > now || lastActivityAt + IDLE <= now) throw new Error('Your email session expired. Verify your email again.');
 return { token: item.token, scope, startedAt: item.startedAt, expiresAt: item.expiresAt, lastActivityAt, renewedAt, clockOffsetMs };
}
export function createVisitorController(port: Port) {
 const grants: Record<VisitorScope, VisitorGrant | null> = { tracking: null, capacity: null };
 const epochs = { tracking: 0, capacity: 0 }, writes = { tracking: Promise.resolve(), capacity: Promise.resolve() };
 const renewals: Record<VisitorScope, Promise<void> | null> = { tracking: null, capacity: null };
 let foreground = true;
 const live = (scope: VisitorScope) => { const grant = grants[scope], now = port.now(); return grant && now < Math.min(grant.expiresAt - grant.clockOffsetMs, grant.lastActivityAt + IDLE) ? grant : null; };
 const write = (scope: VisitorScope, fn: () => Promise<void>) => { const next = writes[scope].then(fn, fn); writes[scope] = next.catch(() => undefined); return next; };
 const clear = async (scope: VisitorScope) => { epochs[scope]++; grants[scope] = null; port.changed(); try { await write(scope, () => port.remove(scope)); port.storageError?.(scope, ''); } catch (error) { port.storageError?.(scope, 'Saved access could not be removed from this phone. Retry clearing it before closing the app.'); throw error; } };
 const accept = async (scope: VisitorScope, value: unknown, epoch: number, requestedAt?: number) => {
  let candidate = value;
  if (requestedAt !== undefined) {
   if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Verify your email to continue.');
   const wire = value as Record<string, unknown>;
   if (typeof wire.issuedAt !== 'number' || !Number.isSafeInteger(wire.issuedAt) || wire.issuedAt < 0 || typeof wire.startedAt !== 'number' || wire.startedAt > wire.issuedAt) throw new Error('Verify your email to continue.');
   // Anchor to request start, not receipt: transit time can shorten, never extend access.
   candidate = { ...wire, clockOffsetMs: wire.issuedAt - requestedAt, lastActivityAt: requestedAt, renewedAt: requestedAt };
  }
  const grant = parseVisitorGrant(candidate, scope, port.now());
  if (epochs[scope] !== epoch) return;
  await write(scope, async () => { if (epochs[scope] === epoch) await port.write(scope, JSON.stringify(grant)); });
  if (epochs[scope] !== epoch) return;
  grants[scope] = grant; port.changed();
 };
 const touch = async (scope: VisitorScope) => {
  if (!foreground) return;
  const grant = live(scope); if (!grant) { if (grants[scope]) await clear(scope); return; }
  grant.lastActivityAt = port.now();
  if (port.now() - grant.renewedAt < 60000 || renewals[scope]) return renewals[scope];
  const epoch = epochs[scope], requestedAt = port.now();
  const task = (async () => {
   try { const value = await port.request(`/api/mobile/visitor/${scope}/renew`, { token: grant.token, body: {} });
    if (foreground && epochs[scope] === epoch && live(scope)) await accept(scope, value, epoch, requestedAt);
   } catch (error) { if (epochs[scope] === epoch && (error as { status?: number }).status === 401) await clear(scope); throw error; }
  })();
  renewals[scope] = task;
  try { await task; } finally { if (renewals[scope] === task) renewals[scope] = null; }
 };
 return {
  snapshot: () => ({ tracking: live('tracking'), capacity: live('capacity'), foreground }),
  async restore(scope: VisitorScope) { const epoch = epochs[scope]; try { const raw = await port.read(scope); if (raw && epochs[scope] === epoch) await accept(scope, JSON.parse(raw), epoch); } catch { if (epoch === epochs[scope]) await clear(scope); } },
  async verify(scope: VisitorScope, handoff: string, code: string) { await clear(scope); const epoch = epochs[scope], requestedAt = port.now(); const value = await port.request(`/api/mobile/visitor/${scope}/verify`, { body: { handoff, code } }); await accept(scope, value, epoch, requestedAt); },
  async request(scope: VisitorScope, path: string, body?: unknown, signal?: AbortSignal) {
   if (!path.startsWith(`/api/mobile/visitor/${scope}/`) || path.includes('..')) throw new Error('Invalid request.');
   const epoch = epochs[scope], grant = live(scope);
   if (!grant || !foreground) { if (!grant && grants[scope]) await clear(scope); throw new Error('Verify your email to continue.'); }
   // Reading is user activity; background timers never invoke this method.
   void touch(scope).catch(() => undefined);
   try { const result = await port.request(path, { token: grant.token, body, signal });
    if (epochs[scope] !== epoch || !foreground || !live(scope) || signal?.aborted) throw new Error('This email session is no longer active.');
    return result;
   } catch (error) { if (epoch === epochs[scope] && (error as { status?: number }).status === 401) await clear(scope); throw error; }
  },
  touch, clear,
  async expire() { for (const scope of ['tracking', 'capacity'] as const) if (grants[scope] && !live(scope)) await clear(scope); },
  setForeground(value: boolean) { foreground = value; port.changed(); },
 };
}
