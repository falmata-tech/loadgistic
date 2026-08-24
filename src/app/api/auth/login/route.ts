import { NextRequest, NextResponse } from 'next/server.js';
import { verifyPassword, createSessionToken } from '@/lib/security.js';
import { SESSION_COOKIE } from '@/lib/auth';
import { redirectWith, text } from '@/lib/redirects';
import { checkRateLimit, requestKey } from '@/lib/rate-limit';
import { usesSupabaseAuth } from '@/lib/supabase/config';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import { getManagedCurrentUser } from '@/lib/identity/supabase';
import { localFixturePasswordLoginEnabled } from '@/lib/auth-flow.js';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if(!localFixturePasswordLoginEnabled())return redirectWith(request,'/login','error','Password login is available only for local fixture testing.');
  const clientLimit=Number(process.env.LOGIN_CLIENT_RATE_LIMIT||60);
  const accountLimit=Number(process.env.LOGIN_ACCOUNT_RATE_LIMIT||12);
  const clientRate = checkRateLimit(requestKey(request,'login-client'),clientLimit,60_000);
  if (!clientRate.allowed) return redirectWith(request, '/login', 'error', `Too many attempts. Try again in ${clientRate.retryAfterSeconds} seconds.`);
  const form = await request.formData();
  const email = text(form, 'email');
  const password = text(form, 'password');
  const accountRate = checkRateLimit(`${requestKey(request,'login-account')}:${email.toLowerCase()}`,accountLimit,60_000);
  if (!accountRate.allowed) return redirectWith(request, '/login', 'error', `Too many attempts. Try again in ${accountRate.retryAfterSeconds} seconds.`);
  if(usesSupabaseAuth()){
    const response=new NextResponse(null,{status:303,headers:{Location:'/app/home'}});
    const client=createSupabaseRouteClient(request,response);
    const {data,error}=await client.auth.signInWithPassword({email,password});
    const projection=!error&&data.user?await getManagedCurrentUser(client,data.user):null;
    if(error||!projection||!projection.active){
      await client.auth.signOut();
      response.headers.set('Location','/login?error=The+email+or+password+is+incorrect.');
      return response;
    }
    response.headers.set('Location',projection.role==='SUPPORT'?'/support':'/app/home');
    return response;
  }
  const {findUserByEmail}=await import('@/lib/repository.js');
  const user = await findUserByEmail(email);
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
