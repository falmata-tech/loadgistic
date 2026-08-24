import { NextRequest, NextResponse } from 'next/server.js';
import { MANAGED_AUTH_UNAVAILABLE, managedAuthCallbackUrl } from '@/lib/auth-flow.js';
import { checkRateLimit, requestKey } from '@/lib/rate-limit';
import { redirectUrl } from '@/lib/redirects';
import { getSupabasePublicConfig, usesSupabaseAuth } from '@/lib/supabase/config';
import { createSupabaseRouteClient } from '@/lib/supabase/route';

export const runtime = 'nodejs';

function unavailable(request:NextRequest) {
  const location=redirectUrl(request,'/login');
  location.searchParams.set('error',MANAGED_AUTH_UNAVAILABLE);
  return NextResponse.redirect(location,303);
}

export async function POST(request:NextRequest) {
  const rate=checkRateLimit(requestKey(request,'managed-google-login'),10,10*60_000);
  if(!rate.allowed||!usesSupabaseAuth())return unavailable(request);
  const callbackUrl=managedAuthCallbackUrl({requestUrl:request.url});
  if(!callbackUrl)return unavailable(request);

  const response=NextResponse.redirect(redirectUrl(request,'/login'),303);
  response.headers.set('Cache-Control','no-store');
  try{
    const client=createSupabaseRouteClient(request,response);
    const {data,error}=await client.auth.signInWithOAuth({
      provider:'google',
      options:{
        redirectTo:callbackUrl,
        scopes:'openid email profile',
        skipBrowserRedirect:true
      }
    });
    const providerUrl=data.url?new URL(data.url):null;
    const supabaseOrigin=new URL(getSupabasePublicConfig().url).origin;
    if(error||!providerUrl||providerUrl.origin!==supabaseOrigin)return unavailable(request);
    response.headers.set('Location',providerUrl.toString());
    return response;
  }catch{
    return unavailable(request);
  }
}
