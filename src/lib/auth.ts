import {parseTrackingSession,trackingSessionSubject,trackingSessionSeconds} from './tracking-session.js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSessionToken, verifySessionToken } from './security.js';
import { getManagedCurrentUser } from './identity/supabase';
import { getManagedWorkspaceAccess } from './identity/workspace-access.js';
import { createSupabaseServerClient } from './supabase/server';

export const TRACKING_GRANT_COOKIE = 'lg_tracking_grant';
export const REVIEW_GRANT_COOKIE = 'lg_review_grant';
const SHARED_CAPACITY_COOKIE = 'lg_shared_capacity';
export const TRACKING_IDLE_SECONDS = 5 * 60;

export async function getCurrentUser(options:{allowLimited?:boolean}={}) {
  const client=await createSupabaseServerClient();
  const {data,error}=await client.auth.getUser();
  if(error||!data.user)return null;
  const user=await getManagedCurrentUser(client,data.user);
  if(!user||!user.active)return null;
  if(!options.allowLimited&&!getManagedWorkspaceAccess(user).granted)return null;
  return user;
}

export async function requireUser(allowedRoles?: string[],options:{allowLimited?:boolean}={}) {
  const user = await getCurrentUser({allowLimited:true});
  if (!user) redirect('/login?error=Please+log+in');
  if (allowedRoles && !allowedRoles.includes(user.role)) redirect('/app/home?error=You+do+not+have+access+to+that+page');
  if (!options.allowLimited) {
    const access=getManagedWorkspaceAccess(user);
    if(!access.granted)redirect('/app/home?error=Workspace+not+available');
  }
  return user;
}

export async function hasTrackingGrant(shipmentId: string) {
  return false;
}

type RetiredTrackingGrant={recipientDigest:string;startedAt:number;expiresAt:number;shipmentId:string|null};
/** Old anonymous email grants never become per-load link grants. */
export async function getProviderTrackingGrant(shipmentId?:string):Promise<RetiredTrackingGrant|null> {
  return null;
}

export async function getTrackingEmailSession():Promise<Omit<RetiredTrackingGrant,'shipmentId'>|null>{
  return null;
}

export async function setTrackingEmailSession(recipientDigest:string,startedAt=Date.now()){
  throw new Error('TRACKING_LINK_REQUIRED');
}

export async function setProviderTrackingGrant(shipmentId:string,recipientDigest:string) {
  throw new Error('TRACKING_LINK_REQUIRED');
}

export async function clearProviderTrackingGrant() {
  const store=await cookies();
  store.set(TRACKING_GRANT_COOKIE,'',{
    httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0
  });
}

export async function hasProviderReviewGrant(shipmentId:string) {
  return false;
}

export async function clearSharedCapacitySession() {
  const store=await cookies();
  store.set(SHARED_CAPACITY_COOKIE,'',{
    httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0
  });
}
