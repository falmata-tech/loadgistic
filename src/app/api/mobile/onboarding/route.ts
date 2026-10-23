import {businessWorkspaceService} from '@/lib/business-workspaces/application';
import {supabaseBusinessWorkspacePort} from '@/lib/business-workspaces/supabase';
import { randomUUID } from 'node:crypto';
import { mobileVerifiedIdentity, mobileBody, mobileFailure, mobileJson, MobileError } from '@/lib/mobile/server';
import { managedProviderSignupEligible, normalizeProviderSignupInput, prepareManagedProviderSignup, completeManagedProviderSignup } from '@/lib/provider-signup.js';
import { hasJoinableFleetInvitation } from '@/lib/fleet-driver-management';
import { checkRateLimit } from '@/lib/rate-limit';
import {contentPolicyAccepted} from '@/lib/privacy/content-policy.js';
import {errorMessage} from '@/lib/errors';
export const runtime = 'nodejs';
export async function GET(request:Request){
 try{const user=await mobileVerifiedIdentity(request);return mobileJson({canCreateProvider:await managedProviderSignupEligible(user.id)});}
 catch(error){return mobileFailure(error);}
}
export async function POST(request: Request) {
  try {
    const user = await mobileVerifiedIdentity(request);
    if(!await contentPolicyAccepted(user.id))throw new MobileError(403,'POLICY_REQUIRED','Read and accept the current terms before sharing content.');
    const rate = await checkRateLimit(`mobile-onboarding:${user.id}`, 5, 600000);
    if (!rate.allowed) throw new MobileError(429, 'PLEASE_WAIT', 'Please wait before trying again.');
    if (!user.active&&await hasJoinableFleetInvitation(user.id) || !await managedProviderSignupEligible(user.id)) throw new MobileError(403, 'SIGNUP_UNAVAILABLE', 'This account cannot create another workspace.');
    const input = normalizeProviderSignupInput(await mobileBody(request));
    if (!input.ok) throw new MobileError(400, 'INVALID_INPUT', input.error || 'Check your details.');
    const token = randomUUID().replaceAll('-', '');
    await prepareManagedProviderSignup(input.input, token);
    await completeManagedProviderSignup(user.id, token);
    await businessWorkspaceService(supabaseBusinessWorkspacePort()).select(user.id,null);
    return mobileJson({ ok: true });
  } catch (error) {
    if(error instanceof Error&&/^(ACCOUNT_HANDLE_UNAVAILABLE|INVALID_ACCOUNT_HANDLE|INVALID_PUBLIC_ACCOUNT_NAME)$/.test(error.message))return mobileFailure(new MobileError(400,'INVALID_INPUT',errorMessage(error)));
    return mobileFailure(error);
  }
}
