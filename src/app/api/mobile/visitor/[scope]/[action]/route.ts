import { after } from 'next/server.js';
import { z } from 'zod';
import { mobileBody, mobileFailure, mobileJson, MobileError } from '@/lib/mobile/server';
import { issueVisitor, issueReviewVisitor, requireVisitor, visitorScope } from '@/lib/mobile/visitor-server';
import { createSessionToken, verifySessionToken } from '@/lib/security.js';
import { requestTrackingEmailSession, verifyTrackingEmailSession, listTrackingEmailShipments } from '@/lib/provider-tracking.js';
import { requestSharedCapacityOtp, verifySharedCapacityAccess } from '@/lib/private-capacity.js';
import { deliverTargetedAccessEmail } from '@/lib/email-delivery';
import { checkOriginBeforeScopedLimit } from '@/lib/guest-rate-limit.js';
import { checkRateLimit, requestKey } from '@/lib/rate-limit';
export const runtime = 'nodejs';
const emailInput = z.object({ email: z.string().trim().toLowerCase().email().max(254) }).strict();
const verifyInput = z.object({ handoff: z.string().max(2048).regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/), code: z.string().regex(/^\d{6}$/) }).strict();
const challengeInput = z.object({ email: z.string().email(), challengeId: z.string().uuid() }).strict();
export async function POST(request: Request, context: { params: Promise<{ scope: string; action: string }> }) {
 try {
  const params = await context.params, scope = visitorScope(params.scope), action = params.action;
  if (!['request', 'verify', 'renew'].includes(action)) throw new MobileError(404, 'NOT_FOUND', 'Not found.');
  if (action === 'renew') {
   const session = await requireVisitor(request, scope);
   const rate = await checkRateLimit(requestKey(request, `mobile-visitor-renew:${scope}`), 60, 60000);
   if (!rate.allowed) throw new MobileError(429, 'PLEASE_WAIT', 'Please wait and try again.');
   if (scope === 'tracking' && !(await listTrackingEmailShipments(session.digest)).total) throw new MobileError(401, 'EMAIL_REQUIRED', 'No shipments are currently shared with this email.');
   return mobileJson('reviewActorId' in session ? issueReviewVisitor(scope, String(session.reviewActorId), session.startedAt) : issueVisitor(scope, session.digest, session.startedAt));
  }
  // Same budgets as the browser endpoints: another client is not another allowance.
  const prefix = scope === 'tracking' ? action === 'request' ? 'tracking-otp' : 'tracking-unlock' : action === 'request' ? 'shared-capacity-otp' : 'shared-capacity-access';
  const scopedPrefix = scope === 'tracking' && action === 'request' ? 'tracking-otp-recipient' : `${prefix}-email`;
  const rate = await checkOriginBeforeScopedLimit({ originKey: requestKey(request, prefix), originLimit: scope === 'tracking' && action === 'request' ? 10 : 12, scopedLimit: scope === 'tracking' && action === 'request' ? 3 : 5, windowMs: 10 * 60000,
   readScope: async () => {
    const body = await mobileBody(request);
    let email: string, challengeId = '', code = '';
    if (action === 'request') { const parsed = emailInput.safeParse(body); if (!parsed.success) throw new MobileError(400, 'INVALID_INPUT', 'Enter a valid email.'); email = parsed.data.email; }
    else {
     const parsed = verifyInput.safeParse(body); if (!parsed.success) throw new MobileError(400, 'INVALID_INPUT', 'Enter the six-digit email code.');
     const subject = String(verifySessionToken(parsed.data.handoff)?.sub || ''), marker = `mobile-visitor-otp:${scope}:`;
     let challenge; try { challenge = challengeInput.parse(JSON.parse(Buffer.from(subject.startsWith(marker) ? subject.slice(marker.length) : '', 'base64url').toString())); } catch { throw new MobileError(401, 'INVALID_CODE', 'Request a new email code.'); }
     email = challenge.email; challengeId = challenge.challengeId; code = parsed.data.code;
    }
    return { key: `${scopedPrefix}:${email}`, value: { email, challengeId, code } };
   },
  });
  if (!rate.allowed || !rate.scope) throw new MobileError(429, 'PLEASE_WAIT', 'Please wait before requesting or trying another code.');
  const input = rate.scope;
  if (action === 'request') {
   const challenge = scope === 'tracking' ? await requestTrackingEmailSession(input.email) : await requestSharedCapacityOtp(input.email);
   if (challenge.deliveryQueued) after(async () => { try { await deliverTargetedAccessEmail(scope === 'tracking' ? 'TRACKING_OTP' : 'SHARED_CAPACITY', challenge.challengeId); } catch { /* Committed outbox retries separately. */ } });
   const handoff = createSessionToken(`mobile-visitor-otp:${scope}:${Buffer.from(JSON.stringify({ email: input.email, challengeId: challenge.challengeId })).toString('base64url')}`, 600);
   // Match the existing capacity no-share message; Tracking remains non-enumerating.
   return mobileJson({ handoff, verificationRequired: scope === 'tracking' || challenge.deliveryQueued, message: scope === 'capacity' && !challenge.deliveryQueued ? 'No transporter has shared capacity with this email yet.' : 'If access is shared with this email, a code will arrive shortly. Check spam too.' });
  }
  try {
   if (scope === 'tracking') { const access = await verifyTrackingEmailSession(input.email, input.challengeId, input.code); return mobileJson(issueVisitor(scope, access.recipientDigest)); }
   const access = await verifySharedCapacityAccess(input.email, input.code); return mobileJson(issueVisitor(scope, access.emailDigest));
  } catch { throw new MobileError(401, 'INVALID_CODE', 'That email code is incorrect or expired.'); }
 } catch (error) { return mobileFailure(error); }
}
