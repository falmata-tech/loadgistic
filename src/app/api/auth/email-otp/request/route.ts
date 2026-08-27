import { NextRequest, NextResponse } from 'next/server.js';
import { MANAGED_AUTH_CODE_SENT, MANAGED_AUTH_UNAVAILABLE, managedAuthCallbackUrl, normalizeManagedAuthEmail } from '@/lib/auth-flow.js';
import { checkRateLimit, requestKey } from '@/lib/rate-limit';
import { redirectUrl, redirectWith, text } from '@/lib/redirects';
import { usesSupabaseAuth } from '@/lib/supabase/config';
import { createSupabaseRouteClient } from '@/lib/supabase/route';

export const runtime='nodejs';

export async function POST(request:NextRequest) {
  if(!usesSupabaseAuth())return redirectWith(request,'/login','error',MANAGED_AUTH_UNAVAILABLE);
  const form=await request.formData();
  const email=normalizeManagedAuthEmail(text(form,'email'));
  if(!email)return redirectWith(request,'/login','error','Enter a valid email address.');
  const clientRate=await checkRateLimit(requestKey(request,'managed-email-otp-request'),8,10*60_000);
  const accountRate=await checkRateLimit(`managed-email-otp-request:${email}`,3,10*60_000);
  if(!clientRate.allowed||!accountRate.allowed){
    return redirectWith(request,'/login','error','Please wait before requesting another code.');
  }
  const callbackUrl=managedAuthCallbackUrl({requestUrl:request.url});
  if(!callbackUrl)return redirectWith(request,'/login','error',MANAGED_AUTH_UNAVAILABLE);

  const location=redirectUrl(request,'/login');
  location.searchParams.set('step','code');
  location.searchParams.set('success',MANAGED_AUTH_CODE_SENT);
  const response=NextResponse.redirect(location,303);
  response.headers.set('Cache-Control','no-store');
  try{
    const client=createSupabaseRouteClient(request,response);
    await client.auth.signInWithOtp({
      email,
      options:{shouldCreateUser:false,emailRedirectTo:callbackUrl}
    });
  }catch{
    // Account state and upstream delivery failures share one bounded response.
  }
  return response;
}
