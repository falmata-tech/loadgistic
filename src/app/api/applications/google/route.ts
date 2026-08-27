import {NextRequest,NextResponse} from 'next/server.js';
import {MANAGED_AUTH_UNAVAILABLE,managedAuthCallbackUrl} from '@/lib/auth-flow.js';
import {
  createProviderSignupHandoff,MANAGED_SIGNUP_COOKIE,MANAGED_SIGNUP_MAX_AGE_SECONDS
} from '@/lib/provider-signup.js';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
import {redirectUrl} from '@/lib/redirects';
import {getSupabasePublicConfig,usesSupabaseAuth} from '@/lib/supabase/config';
import {createSupabaseRouteClient} from '@/lib/supabase/route';

export const runtime='nodejs';

function unavailable(request:NextRequest){
  const location=redirectUrl(request,'/apply');
  location.searchParams.set('error',MANAGED_AUTH_UNAVAILABLE);
  return NextResponse.redirect(location,303);
}

export async function POST(request:NextRequest){
  const rate=await checkRateLimit(requestKey(request,'provider-signup-google'),5,10*60_000);
  if(!rate.allowed||!usesSupabaseAuth())return unavailable(request);
  const callbackUrl=managedAuthCallbackUrl({requestUrl:request.url});
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
    response.cookies.set(MANAGED_SIGNUP_COOKIE,createProviderSignupHandoff(),{
      httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',
      maxAge:MANAGED_SIGNUP_MAX_AGE_SECONDS
    });
    response.headers.set('Location',providerUrl.toString());
    return response;
  }catch{
    return unavailable(request);
  }
}
