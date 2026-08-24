import {randomUUID} from 'node:crypto';
import { NextRequest,NextResponse } from 'next/server.js';
import {managedAuthCallbackUrl} from '@/lib/auth-flow.js';
import {
  MANAGED_SIGNUP_COOKIE,MANAGED_SIGNUP_ERROR,MANAGED_SIGNUP_MAX_AGE_SECONDS,
  normalizeProviderSignupInput,prepareManagedProviderSignup
} from '@/lib/provider-signup.js';
import { redirectUrl,redirectWith,text } from '@/lib/redirects';
import { checkRateLimit, requestKey } from '@/lib/rate-limit';
import {getSupabasePublicConfig,usesSupabaseAuth} from '@/lib/supabase/config';
import {createSupabaseRouteClient} from '@/lib/supabase/route';

export const runtime='nodejs';

export async function POST(request:NextRequest){
  const rate=checkRateLimit(requestKey(request,'provider-signup'),5,10*60_000);
  if(!rate.allowed)return redirectWith(request,'/apply','error',`Please wait ${rate.retryAfterSeconds} seconds before trying again.`);
  if(!usesSupabaseAuth())return redirectWith(request,'/apply','error',MANAGED_SIGNUP_ERROR);
  const form=await request.formData();
  const normalized=normalizeProviderSignupInput({
    name:text(form,'name'),businessName:text(form,'businessName'),phone:text(form,'phone'),
    applicationType:text(form,'applicationType'),notes:text(form,'notes')
  });
  if(!normalized.ok)return redirectWith(request,'/apply','error',normalized.error||MANAGED_SIGNUP_ERROR);
  const callbackUrl=managedAuthCallbackUrl({requestUrl:request.url});
  if(!callbackUrl)return redirectWith(request,'/apply','error',MANAGED_SIGNUP_ERROR);

  const token=randomUUID().replaceAll('-','');
  const response=NextResponse.redirect(redirectUrl(request,'/apply'),303);
  response.headers.set('Cache-Control','no-store');
  try{
    await prepareManagedProviderSignup(normalized.input,token);
    const client=createSupabaseRouteClient(request,response);
    const {data,error}=await client.auth.signInWithOAuth({
      provider:'google',
      options:{redirectTo:callbackUrl,scopes:'openid email profile',skipBrowserRedirect:true}
    });
    const providerUrl=data.url?new URL(data.url):null;
    const supabaseOrigin=new URL(getSupabasePublicConfig().url).origin;
    if(error||!providerUrl||providerUrl.origin!==supabaseOrigin)throw new Error('SIGNUP_OAUTH_UNAVAILABLE');
    response.cookies.set(MANAGED_SIGNUP_COOKIE,token,{
      httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',
      maxAge:MANAGED_SIGNUP_MAX_AGE_SECONDS
    });
    response.headers.set('Location',providerUrl.toString());
    return response;
  }catch{
    return redirectWith(request,'/apply','error',MANAGED_SIGNUP_ERROR);
  }
}
