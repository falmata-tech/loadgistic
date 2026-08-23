import { NextRequest, NextResponse } from 'next/server.js';
import { findUserByEmail } from '@/lib/repository.js';
import { verifyPassword, createSessionToken } from '@/lib/security.js';
import { SESSION_COOKIE } from '@/lib/auth';
import { redirectWith, text } from '@/lib/redirects';
import { checkRateLimit, requestKey } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const clientLimit=Number(process.env.LOGIN_CLIENT_RATE_LIMIT||60);
  const accountLimit=Number(process.env.LOGIN_ACCOUNT_RATE_LIMIT||12);
  const clientRate = checkRateLimit(requestKey(request,'login-client'),clientLimit,60_000);
  if (!clientRate.allowed) return redirectWith(request, '/login', 'error', `Too many attempts. Try again in ${clientRate.retryAfterSeconds} seconds.`);
  const form = await request.formData();
  const email = text(form, 'email');
  const password = text(form, 'password');
  const accountRate = checkRateLimit(`${requestKey(request,'login-account')}:${email.toLowerCase()}`,accountLimit,60_000);
  if (!accountRate.allowed) return redirectWith(request, '/login', 'error', `Too many attempts. Try again in ${accountRate.retryAfterSeconds} seconds.`);
  const user = findUserByEmail(email);
  if (!user || !user.active || !await verifyPassword(password, user.password_hash)) {
    return redirectWith(request, '/login', 'error', 'The email or password is incorrect.');
  }
  // A relative Location preserves the browser's public origin even when a
  // development proxy rewrites every request URL and host header.
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: user.role === 'SUPPORT' ? '/support' : '/app/home' }
  });
  response.cookies.set(SESSION_COOKIE, createSessionToken(user.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12
  });
  return response;
}
