import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSessionToken, verifySessionToken } from './security.js';
import { getUserById, getWorkspaceAccess } from './repository.js';

export const SESSION_COOKIE = 'lg_session';
export const TRACKING_GRANT_COOKIE = 'lg_tracking_grant';
export const REVIEW_GRANT_COOKIE = 'lg_review_grant';
export const SHARED_CAPACITY_COOKIE = 'lg_shared_capacity';
export const GUEST_SUPPORT_COOKIE = 'lg_guest_support';
export const TRACKING_IDLE_SECONDS = 5 * 60;
export const SHARED_CAPACITY_IDLE_SECONDS = 30 * 60;

export async function getCurrentUser(options:{allowLimited?:boolean}={}) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  if (!payload) return null;
  const user = await getUserById(payload.sub);
  if (!user || !user.active) return null;
  if (!options.allowLimited && !(await getWorkspaceAccess(user)).granted) return null;
  return user;
}

export async function requireUser(allowedRoles?: string[],options:{allowLimited?:boolean}={}) {
  const user = await getCurrentUser({allowLimited:true});
  if (!user) redirect('/login?error=Please+log+in');
  if (allowedRoles && !allowedRoles.includes(user.role)) redirect('/app/home?error=You+do+not+have+access+to+that+page');
  if (!options.allowLimited && !(await getWorkspaceAccess(user)).granted) redirect('/app/home?billing=required');
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

export async function getProviderTrackingGrant(shipmentId?:string) {
  const store=await cookies();
  const payload=verifySessionToken(store.get(TRACKING_GRANT_COOKIE)?.value);
  const match=String(payload?.sub||'').match(/^provider-tracking:([^:]+):(SHIPPER|RECEIVER)$/);
  if(!match||shipmentId&&match[1]!==shipmentId)return null;
  return {shipmentId:match[1],partyRole:match[2] as 'SHIPPER'|'RECEIVER'};
}

export async function hasProviderReviewGrant(shipmentId:string) {
  const store=await cookies();
  const payload=verifySessionToken(store.get(REVIEW_GRANT_COOKIE)?.value);
  return payload?.sub===`provider-review:${shipmentId}`;
}

export async function setSharedCapacitySession(emailDigest:string) {
  const store=await cookies();
  const expiresAt=Date.now()+SHARED_CAPACITY_IDLE_SECONDS*1000;
  store.set(SHARED_CAPACITY_COOKIE,createSessionToken(`shared-capacity:${emailDigest}`,SHARED_CAPACITY_IDLE_SECONDS),{
    httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:SHARED_CAPACITY_IDLE_SECONDS
  });
  return {expiresAt};
}

export async function getSharedCapacitySession() {
  const store=await cookies();
  const payload=verifySessionToken(store.get(SHARED_CAPACITY_COOKIE)?.value);
  const match=String(payload?.sub||'').match(/^shared-capacity:([a-f0-9]{64})$/);
  return match?{emailDigest:match[1],expiresAt:Number(payload.exp)*1000}:null;
}

export async function clearSharedCapacitySession() {
  const store=await cookies();
  store.set(SHARED_CAPACITY_COOKIE,'',{
    httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0
  });
}

export async function setGuestSupportSession(conversationId:string,emailDigest:string) {
  const store=await cookies();
  store.set(GUEST_SUPPORT_COOKIE,createSessionToken(`guest-support:${conversationId}:${emailDigest}`,60*60*24*30),{
    httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*24*30
  });
}

export async function getGuestSupportSession(conversationId?:string) {
  const store=await cookies();
  const payload=verifySessionToken(store.get(GUEST_SUPPORT_COOKIE)?.value);
  const match=String(payload?.sub||'').match(/^guest-support:([^:]+):([a-f0-9]{64})$/);
  if(!match||conversationId&&match[1]!==conversationId)return null;
  return {conversationId:match[1],emailDigest:match[2]};
}
