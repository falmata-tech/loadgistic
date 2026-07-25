import { NextRequest, NextResponse } from 'next/server.js';
import { findUserByEmail } from '@/lib/repository.js';
import { verifyPassword, createSessionToken } from '@/lib/security.js';
import { SESSION_COOKIE } from '@/lib/auth';
import { redirectWith, text } from '@/lib/redirects';
import { checkRateLimit, requestKey } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(requestKey(request,'login'), 12, 60_000);
  if (!rate.allowed) return redirectWith(request, '/login', 'error', `Too many attempts. Try again in ${rate.retryAfterSeconds} seconds.`);
  const form = await request.formData();
  const email = text(form, 'email');
  const password = text(form, 'password');
  const user = findUserByEmail(email);
  if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
    return redirectWith(request, '/login', 'error', 'The email or password is incorrect.');
  }
  // A relative Location preserves the browser's public origin even when a
  // development proxy rewrites every request URL and host header.
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: '/app/home' }
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
