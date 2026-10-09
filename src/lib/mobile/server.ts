import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabasePublicConfig } from '@/lib/supabase/config';
import { getManagedCurrentUser, type ManagedCurrentUser } from '@/lib/identity/supabase';
import { getManagedWorkspaceAccess } from '@/lib/identity/workspace-access.js';
import { mobileBearer, mobileAccountState, mobileIdentity } from './identity-policy.js';
import { hasJoinableFleetInvitation } from '@/lib/fleet-driver-management';
import { managedProviderSignupEligible } from '@/lib/provider-signup.js';
import {contentPolicyAccepted} from '@/lib/privacy/content-policy.js';
import {reviewAccountAllowed} from '@/lib/privacy/review-access.js';

export class MobileError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function mobileClient(token?: string): SupabaseClient {
  const { url, publishableKey } = getSupabasePublicConfig();
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });
}
export function mobileJson(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store', Vary: 'Authorization' } });
}
export function mobileFailure(error: unknown): Response {
  if (error instanceof MobileError) return mobileJson({ error: { code: error.code, message: error.message } }, error.status);
  return mobileJson({ error: { code: 'UNAVAILABLE', message: 'This service is temporarily unavailable. Please try again.' } }, 503);
}
export async function mobileBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new MobileError(415, 'JSON_REQUIRED', 'Send a JSON request.');
  // Bounded streaming read: Content-Length alone cannot limit chunked requests.
  const reader = request.body?.getReader(); let size = 0; const parts: Uint8Array[] = [];
  if (!reader) throw new MobileError(400, 'INVALID_INPUT', 'Check the information and try again.');
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength;
      if (size > 16384) { await reader.cancel(); throw new MobileError(413, 'INPUT_TOO_LARGE', 'The request is too large.'); } parts.push(value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.length; }
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('INVALID');
    return body as Record<string, unknown>;
  } catch (error) { if (error instanceof MobileError) throw error; throw new MobileError(400, 'INVALID_INPUT', 'Check the information and try again.'); }
  finally { reader.releaseLock(); }
}
export async function mobileVerifiedIdentity(request: Request): Promise<ManagedCurrentUser> {
  const token = mobileBearer(request.headers.get('authorization'));
  if (!token) throw new MobileError(401, 'SIGN_IN_REQUIRED', 'Sign in to continue.');
  const client = mobileClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new MobileError(401, 'SIGN_IN_REQUIRED', 'Please sign in again.');
  if(data.user.app_metadata?.loadgistic_review===true&&!await reviewAccountAllowed(data.user.id))throw new MobileError(403,'ACCOUNT_UNAVAILABLE','This review account is unavailable.');
  const user = await getManagedCurrentUser(client, data.user);
  if (!user || user.id !== data.user.id) throw new MobileError(401, 'SIGN_IN_REQUIRED', 'Please sign in again.');
  if (['ADMIN', 'SUPPORT'].includes(user.role)) throw new MobileError(403, 'WEB_ONLY', 'Use the website for staff access.');
  return user;
}
export async function mobileActor(request: Request, allowLimited = false): Promise<ManagedCurrentUser> {
  const user = await mobileVerifiedIdentity(request);
  const state = mobileAccountState(user, user.id);
  if (state !== 'ACTIVE' || !user) throw new MobileError(403, state === 'WEB_ONLY' ? 'WEB_ONLY' : 'ACCOUNT_UNAVAILABLE', state === 'WEB_ONLY' ? 'Use the website for staff access.' : 'This account cannot access the workspace.');
  if (!allowLimited && !getManagedWorkspaceAccess(user).granted) throw new MobileError(403, 'WORKSPACE_REQUIRED', 'This account is not linked to a transport workspace.');
  if(request.method!=='GET'&&request.method!=='HEAD'&&!await contentPolicyAccepted(user.id))throw new MobileError(403,'POLICY_REQUIRED','Read and accept the current terms before sharing content.');
  return user;
}
export async function mobileSession(client: SupabaseClient, session: { access_token: string; refresh_token: string; expires_at?: number; user: { id: string } }) {
  const { data, error } = await client.auth.getUser(session.access_token);
  if (error || !data.user || data.user.id !== session.user.id) throw new MobileError(401, 'SIGN_IN_REQUIRED', 'Please sign in again.');
  if(data.user.app_metadata?.loadgistic_review===true&&!await reviewAccountAllowed(data.user.id))throw new MobileError(403,'ACCOUNT_UNAVAILABLE','This review account is unavailable.');
  const user = await getManagedCurrentUser(client, data.user);
  if (!user) throw new MobileError(403, 'ACCOUNT_UNAVAILABLE', 'This account is unavailable.');
  const canJoin = !user.active && !['ADMIN', 'SUPPORT'].includes(user.role) && await hasJoinableFleetInvitation(user.id);
  const canSignUp = !user.active && !canJoin && !['ADMIN', 'SUPPORT'].includes(user.role) && await managedProviderSignupEligible(user.id);
  const state = mobileAccountState(user, data.user.id, { canJoin, canSignUp });
  if (state === 'DENIED' || state === 'WEB_ONLY') throw new MobileError(403, state, state === 'WEB_ONLY' ? 'Use the website for staff access.' : 'This account cannot sign in.');
  return { accessToken: session.access_token, refreshToken: session.refresh_token, expiresAt: session.expires_at,
    state, user: {...mobileIdentity(user),review:data.user.app_metadata?.loadgistic_review===true}, access: state === 'ACTIVE' ? getManagedWorkspaceAccess(user) : null };
}
