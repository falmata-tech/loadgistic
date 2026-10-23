import {businessWorkspaceService} from '@/lib/business-workspaces/application';
import {supabaseBusinessWorkspacePort} from '@/lib/business-workspaces/supabase';
import {contentPolicyAccepted} from '@/lib/privacy/content-policy.js';
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
import {errorMessage} from '@/lib/errors';

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
    ...(form.has('firstName')?{firstName:text(form,'firstName'),lastName:text(form,'lastName')}:{name:text(form,'name')}),businessName:text(form,'businessName'),...(form.has('accountName')?{accountName:text(form,'accountName'),handle:text(form,'handle')}:{}),phone:text(form,'phone'),
    applicationType:text(form,'applicationType'),notes:text(form,'notes'),...(text(form,'applicationType')==='TRANSPORT_PROVIDER'?{drivesTruck:form.has('drivesTruck')}:{})
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
    const eligible=await managedProviderSignupEligible(data.user.id);
    if(projection.active&&!eligible){
      response.headers.set('Location',managedWorkspaceDestination(projection.role,projection.selected_business_workspace));
      clearSignupCookie(response);
      return response;
    }
    if(!eligible){
      await client.auth.signOut();
      clearSignupCookie(response);
      return response;
    }

    if(!await contentPolicyAccepted(data.user.id))return responseFor(request,'/apply?step=details','Read and accept the current terms before continuing.');
    const provisioningToken=randomUUID().replaceAll('-','');
    await prepareManagedProviderSignup(normalized.input,provisioningToken);
    await completeManagedProviderSignup(data.user.id,provisioningToken);
    await businessWorkspaceService(supabaseBusinessWorkspacePort()).select(data.user.id,null);
    const completed=await getManagedCurrentUser(client,data.user);
    if(!completed?.active)throw new Error('SIGNUP_NOT_AVAILABLE');
    response.headers.set('Location',managedWorkspaceDestination(completed.role,completed.selected_business_workspace));
    clearSignupCookie(response);
    return response;
  }catch(error){
    if(error instanceof Error&&/^(ACCOUNT_HANDLE_UNAVAILABLE|INVALID_ACCOUNT_HANDLE|INVALID_PUBLIC_ACCOUNT_NAME)$/.test(error.message))return responseFor(request,'/apply?step=details',errorMessage(error));
    return response;
  }
}
