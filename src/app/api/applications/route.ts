import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server.js';
import {managedWorkspaceDestination} from '@/lib/auth-flow.js';
import {getManagedCurrentUser} from '@/lib/identity/supabase';
import {
  completeManagedProviderSignup,managedProviderSignupEligible,MANAGED_SIGNUP_COOKIE,MANAGED_SIGNUP_ERROR,
  normalizeProviderSignupInput,prepareManagedProviderSignup,readProviderSignupHandoff
} from '@/lib/provider-signup.js';
import {redirectUrl,text} from '@/lib/redirects';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
import {createSupabaseRouteClient} from '@/lib/supabase/route';

export const runtime='nodejs';

function responseFor(request:NextRequest,path='/apply',error=''){
  const location=redirectUrl(request,path);
  if(error)location.searchParams.set('error',error);
  const response=NextResponse.redirect(location,303);
  response.headers.set('Cache-Control','no-store');
  return response;
}

function clearSignupCookie(response:NextResponse){
  response.cookies.set(MANAGED_SIGNUP_COOKIE,'',{
    httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0
  });
}

export async function POST(request:NextRequest){
  const rate=await checkRateLimit(requestKey(request,'provider-signup-complete'),5,10*60_000);
  if(!rate.allowed)return responseFor(request,'/apply',`Please wait ${rate.retryAfterSeconds} seconds before trying again.`);
  const handoff=readProviderSignupHandoff(request.cookies.get(MANAGED_SIGNUP_COOKIE)?.value||'');
  if(!handoff)return responseFor(request,'/apply',MANAGED_SIGNUP_ERROR);

  const form=await request.formData();
  const normalized=normalizeProviderSignupInput({
    name:text(form,'name'),businessName:text(form,'businessName'),phone:text(form,'phone'),
    applicationType:text(form,'applicationType'),notes:text(form,'notes')
  });
  if(!normalized.ok)return responseFor(request,'/apply?step=details',normalized.error||MANAGED_SIGNUP_ERROR);

  const response=responseFor(request,'/apply?step=details',MANAGED_SIGNUP_ERROR);
  try{
    const client=createSupabaseRouteClient(request,response);
    const {data,error}=await client.auth.getUser();
    const projection=!error&&data.user?await getManagedCurrentUser(client,data.user):null;
    if(error||!data.user||!projection)throw new Error('SIGNUP_IDENTITY_REQUIRED');
    const authenticatedEmail=String(data.user.email||'').trim().toLowerCase();
    if(handoff.email&&authenticatedEmail!==handoff.email)throw new Error('SIGNUP_IDENTITY_MISMATCH');
    if(projection.active){
      response.headers.set('Location',managedWorkspaceDestination(projection.role));
      clearSignupCookie(response);
      return response;
    }
    if(!await managedProviderSignupEligible(data.user.id)){
      await client.auth.signOut();
      clearSignupCookie(response);
      return response;
    }

    const provisioningToken=randomUUID().replaceAll('-','');
    await prepareManagedProviderSignup(normalized.input,provisioningToken);
    await completeManagedProviderSignup(data.user.id,provisioningToken);
    const completed=await getManagedCurrentUser(client,data.user);
    if(!completed?.active)throw new Error('SIGNUP_NOT_AVAILABLE');
    response.headers.set('Location',managedWorkspaceDestination(completed.role));
    clearSignupCookie(response);
    return response;
  }catch{
    return response;
  }
}
