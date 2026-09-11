import { NextRequest, NextResponse } from 'next/server.js';
import { redirectWith, text } from '@/lib/redirects';
import { checkRateLimit, requestKey } from '@/lib/rate-limit';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import { getManagedCurrentUser } from '@/lib/identity/supabase';
import { localFixturePasswordLoginEnabled } from '@/lib/auth-flow.js';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if(!localFixturePasswordLoginEnabled())return redirectWith(request,'/login','error','Password login is available only for local fixture testing.');
  const clientLimit=Number(process.env.LOGIN_CLIENT_RATE_LIMIT||60);
  const accountLimit=Number(process.env.LOGIN_ACCOUNT_RATE_LIMIT||12);
  const clientRate = await checkRateLimit(requestKey(request,'login-client'),clientLimit,60_000);
  if (!clientRate.allowed) return redirectWith(request, '/login', 'error', `Too many attempts. Try again in ${clientRate.retryAfterSeconds} seconds.`);
  const form = await request.formData();
  const email = text(form, 'email');
  const password = text(form, 'password');
  const accountRate = await checkRateLimit(`${requestKey(request,'login-account')}:${email.toLowerCase()}`,accountLimit,60_000);
  if (!accountRate.allowed) return redirectWith(request, '/login', 'error', `Too many attempts. Try again in ${accountRate.retryAfterSeconds} seconds.`);
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
