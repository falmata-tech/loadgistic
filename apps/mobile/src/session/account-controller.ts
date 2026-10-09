import { parseSession, type AccountSession } from './contract.ts';
import { ApiError } from '../api/response.ts';
type Port = {
 now: () => number; read: () => Promise<string | null>; write: (token: string) => Promise<void>; remove: () => Promise<void>;
 request: (path: string, options: { token?: string; body?: unknown }) => Promise<unknown>; changed: () => void;
};
export function createAccountController(port: Port) {
 let session: AccountSession | null = null, error = '', busy = true, epoch = 0, restoreBlocked = false;
 let flight: { epoch: number; promise: Promise<AccountSession | null> } | null = null, writes = Promise.resolve();
 let pendingLogout: AccountSession | null = null, cleanupRequired = false;
 const emit = () => port.changed();
 const save = (fn: () => Promise<void>) => { const next = writes.then(fn, fn); writes = next.catch(() => undefined); return next; };
 const remove = async () => { try { await port.remove(); } catch { await port.write(''); } };
 const revoke = async (value: AccountSession) => { await port.request('/api/mobile/auth/logout', { body: { accessToken: value.accessToken, refreshToken: value.refreshToken } }); };
 const discard = async (value: AccountSession) => { try { await revoke(value); } catch { /* Never revive a discarded session after a network failure. */ } };
 const clear = () => { epoch++; session = null; busy = false; emit(); };
 const accept = async (value: unknown, generation: number) => {
  const next = parseSession(value);
  if (generation !== epoch) { await discard(next); return null; }
  try {
   await save(async () => { if (generation === epoch) await port.write(next.refreshToken); });
  } catch {
   await discard(next);
   throw new Error('Could not securely save sign-in on this phone. Please try again.');
  }
  if (generation !== epoch) { await discard(next); return null; }
  session = next; error = ''; restoreBlocked = false; busy = false; emit(); return next;
 };
 const refresh = (): Promise<AccountSession | null> => {
  if (restoreBlocked) return Promise.resolve(null);
  const generation = epoch;
  if (flight?.epoch === generation) return flight.promise;
  const run = async () => {
   try {
    const token = session?.refreshToken || await port.read();
    if (!token || generation !== epoch || restoreBlocked) return null;
    return await accept(await port.request('/api/mobile/auth/refresh', { body: { refreshToken: token } }), generation);
   } catch (caught) {
    if (generation === epoch) {
     clear();
     if (caught instanceof ApiError && [401, 403].includes(caught.status)) {
      restoreBlocked = true;
      try { await save(remove); } catch { cleanupRequired = true; }
     }
     error = caught instanceof Error ? caught.message : 'Could not reconnect. Please try again.'; emit();
    }
    return null;
   } finally { if (flight?.epoch === generation) flight = null; if (generation === epoch) { busy = false; emit(); } }
  };
  const promise = run(); flight = { epoch: generation, promise }; return promise;
 };
 const signOut = async () => {
  const previous = session || pendingLogout; restoreBlocked = true; clear(); error = ''; emit();
  let storageFailed = false, serverFailed = false;
  try { await save(remove); } catch { storageFailed = true; }
  if (previous) try { await revoke(previous); pendingLogout = null; } catch { serverFailed = true; pendingLogout = previous; }
  cleanupRequired = storageFailed || serverFailed;
  error = storageFailed ? 'Saved sign-in could not be cleared. Keep the app open and retry sign-out.' : serverFailed ? 'Signed out on this phone. Retry to confirm server session revocation.' : '';
  emit();
 };
 return {
  snapshot: () => ({ session, busy, error, cleanupRequired }), refresh, signOut,
  async requestCode(email: string) {
   const data = await port.request('/api/mobile/auth/request', { body: { email } }) as { handoff?: unknown };
   if (typeof data.handoff !== 'string') throw new Error('Could not send a code.'); return data.handoff;
  },
  async verifyCode(handoff: string, code: string) {
   if (cleanupRequired) { await signOut(); if (cleanupRequired) throw new Error('Retry sign-out before signing in again.'); }
   const generation = ++epoch; restoreBlocked = true; session = null; emit();
   await accept(await port.request('/api/mobile/auth/verify', { body: { handoff, code } }), generation);
  },
  async signInReview(email:string,password:string){
   if(cleanupRequired){await signOut();if(cleanupRequired)throw new Error('Retry sign-out before signing in again.');}
   const generation=++epoch;restoreBlocked=true;session=null;emit();
   await accept(await port.request('/api/mobile/review-access',{body:{email,password}}),generation);
  },
  async request(path: string, body?: unknown) {
   const generation = epoch; let active = session;
   if (!active || active.expiresAt * 1000 - port.now() < 60000) active = await refresh();
   if (!active || generation !== epoch) throw new ApiError(401, 'SIGN_IN_REQUIRED', 'Please sign in again.');
   try {
    const result = await port.request(path, { token: active.accessToken, body });
    if (generation !== epoch) throw new ApiError(401, 'SESSION_CHANGED', 'Please sign in again.');
    return result;
   } catch (caught) {
    if (generation === epoch && caught instanceof ApiError && [401, 403].includes(caught.status) && ['SIGN_IN_REQUIRED', 'WEB_ONLY', 'ACCOUNT_UNAVAILABLE'].includes(caught.code)) {
     restoreBlocked = true; clear(); try { await save(remove); } catch { cleanupRequired = true; error = 'Saved sign-in could not be cleared. Retry sign-out.'; emit(); }
    }
    throw caught;
   }
  },
  background() { if (session && session.expiresAt * 1000 <= port.now()) { session = null; busy = !restoreBlocked; emit(); } },
 };
}
