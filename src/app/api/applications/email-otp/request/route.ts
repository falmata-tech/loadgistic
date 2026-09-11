import {NextRequest,NextResponse} from 'next/server.js';
import {
  MANAGED_AUTH_CODE_SENT,MANAGED_AUTH_UNAVAILABLE,managedAuthCallbackUrl,normalizeManagedAuthEmail
} from '@/lib/auth-flow.js';
import {
  createProviderSignupHandoff,MANAGED_SIGNUP_COOKIE,MANAGED_SIGNUP_MAX_AGE_SECONDS
} from '@/lib/provider-signup.js';
import {MANAGED_OAUTH_COOKIE} from '@/lib/managed-oauth-flow.js';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
import {redirectUrl,text} from '@/lib/redirects';
import {createSupabaseRouteClient} from '@/lib/supabase/route';

export const runtime='nodejs';

function redirectAccess(request:NextRequest,key:'error'|'success',message:string,step=''){
  const location=redirectUrl(request,'/login');
  if(step)location.searchParams.set('step',step);
  location.searchParams.set(key,message);
  const response=NextResponse.redirect(location,303);
  response.headers.set('Cache-Control','no-store');
  return response;
}

export async function POST(request:NextRequest){
  const form=await request.formData();
  const email=normalizeManagedAuthEmail(text(form,'email'));
  if(!email)return redirectAccess(request,'error','Enter a valid email address.');
  const clientRate=await checkRateLimit(requestKey(request,'managed-account-email-request'),10,10*60_000);
  const accountRate=await checkRateLimit(`managed-account-email-request:${email}`,5,10*60_000);
  if(!clientRate.allowed||!accountRate.allowed){
    const seconds=Math.max(clientRate.retryAfterSeconds,accountRate.retryAfterSeconds);
    const minutes=Math.max(1,Math.ceil(seconds/60));
    return redirectAccess(request,'error',`Too many code requests. Try again in about ${minutes} minute${minutes===1?'':'s'}.`);
  }
  const callbackUrl=managedAuthCallbackUrl({requestUrl:redirectUrl(request,'/').toString()});
  if(!callbackUrl)return redirectAccess(request,'error',MANAGED_AUTH_UNAVAILABLE);

  const response=redirectAccess(request,'success',MANAGED_AUTH_CODE_SENT,'code');
  response.cookies.set(MANAGED_SIGNUP_COOKIE,createProviderSignupHandoff(email),{
    httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',
    maxAge:MANAGED_SIGNUP_MAX_AGE_SECONDS
  });
  response.cookies.set(MANAGED_OAUTH_COOKIE,'',{
    httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0
  });
  try{
    const client=createSupabaseRouteClient(request,response);
    await client.auth.signInWithOtp({
      email,options:{shouldCreateUser:true,emailRedirectTo:callbackUrl}
    });
  }catch{
    // Keep the public response independent of account state and provider detail.
  }
  return response;
}
