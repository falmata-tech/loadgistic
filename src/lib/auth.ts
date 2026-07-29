import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSessionToken, verifySessionToken } from './security.js';
import { getUserById, getWorkspaceAccess } from './repository.js';

export const SESSION_COOKIE = 'lg_session';
export const TRACKING_GRANT_COOKIE = 'lg_tracking_grant';
export const TRACKING_IDLE_SECONDS = 5 * 60;

export async function getCurrentUser(options:{allowLimited?:boolean}={}) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  if (!payload) return null;
  const user = getUserById(payload.sub);
  if (!user || !user.active) return null;
  if (!options.allowLimited && !getWorkspaceAccess(user).granted) return null;
  return user;
}

export async function requireUser(allowedRoles?: string[],options:{allowLimited?:boolean}={}) {
  const user = await getCurrentUser({allowLimited:true});
  if (!user) redirect('/login?error=Please+log+in');
  if (allowedRoles && !allowedRoles.includes(user.role)) redirect('/app/home?error=You+do+not+have+access+to+that+page');
  if (!options.allowLimited && !getWorkspaceAccess(user).granted) redirect('/app/home?billing=required');
  return user;
}

export async function setSession(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12
  });
}

export async function clearSession() {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
}

export async function hasTrackingGrant(shipmentId: string) {
  const store = await cookies();
  const payload = verifySessionToken(store.get(TRACKING_GRANT_COOKIE)?.value);
  return payload?.sub === `tracking:${shipmentId}`;
}
