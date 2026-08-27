import {NextRequest,NextResponse} from 'next/server.js';
import {
  MANAGED_AUTH_CODE_SENT,MANAGED_AUTH_UNAVAILABLE,managedAuthCallbackUrl,normalizeManagedAuthEmail
} from '@/lib/auth-flow.js';
import {
  createProviderSignupHandoff,MANAGED_SIGNUP_COOKIE,MANAGED_SIGNUP_MAX_AGE_SECONDS
} from '@/lib/provider-signup.js';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
import {redirectUrl,text} from '@/lib/redirects';
import {usesSupabaseAuth} from '@/lib/supabase/config';
import {createSupabaseRouteClient} from '@/lib/supabase/route';

export const runtime='nodejs';

function redirectApply(request:NextRequest,key:'error'|'success',message:string,step=''){
  const location=redirectUrl(request,'/apply');
  if(step)location.searchParams.set('step',step);
  location.searchParams.set(key,message);
  const response=NextResponse.redirect(location,303);
  response.headers.set('Cache-Control','no-store');
  return response;
}

export async function POST(request:NextRequest){
  if(!usesSupabaseAuth())return redirectApply(request,'error',MANAGED_AUTH_UNAVAILABLE);
  const form=await request.formData();
  const email=normalizeManagedAuthEmail(text(form,'email'));
  if(!email)return redirectApply(request,'error','Enter a valid email address.');
  const clientRate=checkRateLimit(requestKey(request,'provider-signup-email-request'),5,10*60_000);
  const accountRate=checkRateLimit(`provider-signup-email-request:${email}`,3,10*60_000);
  if(!clientRate.allowed||!accountRate.allowed){
    return redirectApply(request,'error','Please wait before requesting another code.');
  }
  const callbackUrl=managedAuthCallbackUrl({requestUrl:request.url});
  if(!callbackUrl)return redirectApply(request,'error',MANAGED_AUTH_UNAVAILABLE);

  const response=redirectApply(request,'success',MANAGED_AUTH_CODE_SENT,'code');
  try{
    const client=createSupabaseRouteClient(request,response);
    const {error}=await client.auth.signInWithOtp({
      email,options:{shouldCreateUser:true,emailRedirectTo:callbackUrl}
    });
    if(error)throw new Error('SIGNUP_EMAIL_UNAVAILABLE');
    response.cookies.set(MANAGED_SIGNUP_COOKIE,createProviderSignupHandoff(email),{
      httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',
      maxAge:MANAGED_SIGNUP_MAX_AGE_SECONDS
    });
    return response;
  }catch{
    return redirectApply(request,'error',MANAGED_AUTH_UNAVAILABLE);
  }
}
