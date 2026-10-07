import { closeNativeSession } from '@/lib/mobile/logout.js';
import { mobileBody, mobileClient, mobileFailure, mobileJson, MobileError, mobileSession } from '@/lib/mobile/server';
import { createSessionToken, verifySessionToken } from '@/lib/security.js';
import { normalizeManagedAuthEmail, isNumericEmailOtp } from '@/lib/auth-flow.js';
import { checkRateLimit, requestKey } from '@/lib/rate-limit';
export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    const { action } = await context.params;
    if (!['request', 'verify', 'refresh', 'logout'].includes(action)) return mobileJson({ error: { code: 'NOT_FOUND', message: 'Not found.' } }, 404);
    const body = await mobileBody(request);
    const client = mobileClient();
    if (action === 'request' || action === 'verify') {
      const handoff = action === 'verify' && typeof body.handoff === 'string' ? verifySessionToken(body.handoff) : null;
      const match = String(handoff?.sub || '').match(/^mobile-login:([^\s@]+@[^\s@]+\.[^\s@]+)$/);
      const email = normalizeManagedAuthEmail(action === 'request' ? String(body.email || '') : match?.[1] || '');
      if (!email || (action === 'verify' && !isNumericEmailOtp(String(body.code || '')))) throw new MobileError(400, 'INVALID_INPUT', 'Enter a valid email and sign-in code.');
      const scope = action === 'request' ? 'managed-account-email-request' : 'managed-account-email-verify';
      const [ip, account] = await Promise.all([checkRateLimit(requestKey(request, scope), 10, 600000), checkRateLimit(`${scope}:${email}`, action === 'request' ? 5 : 6, 600000)]);
      if (!ip.allowed || !account.allowed) throw new MobileError(429, 'PLEASE_WAIT', 'Please wait before requesting or trying another code.');
      if (action === 'request') {
        await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }).catch(() => undefined);
        return mobileJson({ handoff: createSessionToken(`mobile-login:${email}`, 900), message: 'Check your email for your sign-in code.' });
      }
      let result = await client.auth.verifyOtp({ email, token: String(body.code), type: 'signup' });
      if (result.error) result = await client.auth.verifyOtp({ email, token: String(body.code), type: 'email' });
      if (result.error || !result.data.session || result.data.user?.email?.trim().toLowerCase() !== email) throw new MobileError(401, 'INVALID_CODE', 'The code is incorrect or expired.');
      try { return mobileJson(await mobileSession(client, result.data.session)); }
      catch (error) { await client.auth.signOut({ scope: 'local' }).catch(() => undefined); throw error; }
    }
    const rate = await checkRateLimit(requestKey(request, 'mobile-session'), 60, 60000);
    if (!rate.allowed) throw new MobileError(429, 'PLEASE_WAIT', 'Please wait and try again.');
    if (typeof body.refreshToken !== 'string' || body.refreshToken.length > 2048 || !body.refreshToken) throw new MobileError(401, 'SIGN_IN_REQUIRED', 'Please sign in again.');
    if (action === 'refresh') {
      const { data, error } = await client.auth.refreshSession({ refresh_token: body.refreshToken });
      if (error || !data.session) throw new MobileError(401, 'SIGN_IN_REQUIRED', 'Please sign in again.');
      try { return mobileJson(await mobileSession(client, data.session)); }
      catch (error) { await client.auth.signOut({ scope: 'local' }).catch(() => undefined); throw error; }
    }
    if (typeof body.accessToken !== 'string' || body.accessToken.length > 8192) throw new MobileError(401, 'SIGN_IN_REQUIRED', 'Please sign in again.');
    await closeNativeSession(client.auth, { access_token: body.accessToken, refresh_token: body.refreshToken });
    return mobileJson({ ok: true });
  } catch (error) { return mobileFailure(error); }
}
