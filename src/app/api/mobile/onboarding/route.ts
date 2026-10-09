import { randomUUID } from 'node:crypto';
import { mobileVerifiedIdentity, mobileBody, mobileFailure, mobileJson, MobileError } from '@/lib/mobile/server';
import { managedProviderSignupEligible, normalizeProviderSignupInput, prepareManagedProviderSignup, completeManagedProviderSignup } from '@/lib/provider-signup.js';
import { hasJoinableFleetInvitation } from '@/lib/fleet-driver-management';
import { checkRateLimit } from '@/lib/rate-limit';
import {contentPolicyAccepted} from '@/lib/privacy/content-policy.js';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const user = await mobileVerifiedIdentity(request);
    if(!await contentPolicyAccepted(user.id))throw new MobileError(403,'POLICY_REQUIRED','Read and accept the current terms before sharing content.');
    const rate = await checkRateLimit(`mobile-onboarding:${user.id}`, 5, 600000);
    if (!rate.allowed) throw new MobileError(429, 'PLEASE_WAIT', 'Please wait before trying again.');
    if (user.active || await hasJoinableFleetInvitation(user.id) || !await managedProviderSignupEligible(user.id)) throw new MobileError(403, 'SIGNUP_UNAVAILABLE', 'This account cannot create another workspace.');
    const input = normalizeProviderSignupInput(await mobileBody(request));
    if (!input.ok) throw new MobileError(400, 'INVALID_INPUT', input.error || 'Check your details.');
    const token = randomUUID().replaceAll('-', '');
    await prepareManagedProviderSignup(input.input, token);
    await completeManagedProviderSignup(user.id, token);
    return mobileJson({ ok: true });
  } catch (error) { return mobileFailure(error); }
}
