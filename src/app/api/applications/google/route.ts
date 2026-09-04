import {NextRequest,NextResponse} from 'next/server.js';
import {MANAGED_AUTH_UNAVAILABLE,managedAuthCallbackUrl} from '@/lib/auth-flow.js';
import {
  createProviderSignupHandoff,MANAGED_SIGNUP_COOKIE,MANAGED_SIGNUP_MAX_AGE_SECONDS
} from '@/lib/provider-signup.js';
import {
  createManagedOAuthHandoff,MANAGED_OAUTH_COOKIE,MANAGED_OAUTH_MAX_AGE_SECONDS
} from '@/lib/managed-oauth-flow.js';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
import {redirectUrl} from '@/lib/redirects';
import {getSupabasePublicConfig} from '@/lib/supabase/config';
import {createSupabaseRouteClient} from '@/lib/supabase/route';

export const runtime='nodejs';

function unavailable(request:NextRequest){
  const location=redirectUrl(request,'/login');
  location.searchParams.set('error',MANAGED_AUTH_UNAVAILABLE);
  const response=NextResponse.redirect(location,303);
  for(const name of [MANAGED_OAUTH_COOKIE,MANAGED_SIGNUP_COOKIE])response.cookies.set(name,'',{
    httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0
  });
  return response;
}

export async function POST(request:NextRequest){
  const rate=await checkRateLimit(requestKey(request,'managed-account-google'),8,10*60_000);
  if(!rate.allowed)return unavailable(request);
  const callbackUrl=managedAuthCallbackUrl({requestUrl:redirectUrl(request,'/').toString()});
  if(!callbackUrl)return unavailable(request);
  const response=unavailable(request);
  response.headers.set('Cache-Control','no-store');
  try{
    const client=createSupabaseRouteClient(request,response);
    const {data,error}=await client.auth.signInWithOAuth({
      provider:'google',
      options:{redirectTo:callbackUrl,scopes:'openid email profile',skipBrowserRedirect:true}
    });
    const providerUrl=data.url?new URL(data.url):null;
    const supabaseOrigin=new URL(getSupabasePublicConfig().url).origin;
    if(error||!providerUrl||providerUrl.origin!==supabaseOrigin)throw new Error('SIGNUP_OAUTH_UNAVAILABLE');
    const oauthHandoff=createManagedOAuthHandoff('ACCESS',data.flowId);
    response.cookies.set(MANAGED_SIGNUP_COOKIE,createProviderSignupHandoff(),{
      httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',
      maxAge:MANAGED_SIGNUP_MAX_AGE_SECONDS
    });
    response.cookies.set(MANAGED_OAUTH_COOKIE,oauthHandoff,{
      httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',
      maxAge:MANAGED_OAUTH_MAX_AGE_SECONDS
    });
    response.headers.set('Location',providerUrl.toString());
    return response;
  }catch{
    return unavailable(request);
  }
}
