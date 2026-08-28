import {NextRequest,NextResponse} from 'next/server.js';
import {isNumericEmailOtp,managedWorkspaceDestination} from '@/lib/auth-flow.js';
import {getManagedCurrentUser} from '@/lib/identity/supabase';
import {MANAGED_SIGNUP_COOKIE,MANAGED_SIGNUP_ERROR,readProviderSignupHandoff} from '@/lib/provider-signup.js';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
import {redirectUrl,text} from '@/lib/redirects';
import {createSupabaseRouteClient} from '@/lib/supabase/route';

export const runtime='nodejs';

function responseFor(request:NextRequest,step='code',error=MANAGED_SIGNUP_ERROR){
  const location=redirectUrl(request,'/apply');
  if(step)location.searchParams.set('step',step);
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
  const handoff=readProviderSignupHandoff(request.cookies.get(MANAGED_SIGNUP_COOKIE)?.value||'');
  const code=text(await request.formData(),'code');
  if(!handoff?.email||!isNumericEmailOtp(code))return responseFor(request);
  const clientRate=await checkRateLimit(requestKey(request,'provider-signup-email-verify'),10,10*60_000);
  const accountRate=await checkRateLimit(`provider-signup-email-verify:${handoff.email}`,6,10*60_000);
  if(!clientRate.allowed||!accountRate.allowed)return responseFor(request,'code','Please wait before trying another code.');

  const response=responseFor(request);
  let client:ReturnType<typeof createSupabaseRouteClient>|null=null;
  try{
    client=createSupabaseRouteClient(request,response);
    let verification=await client.auth.verifyOtp({email:handoff.email,token:code,type:'signup'});
    if(verification.error){
      verification=await client.auth.verifyOtp({email:handoff.email,token:code,type:'email'});
    }
    const {data,error}=verification;
    const projection=!error&&data.user?await getManagedCurrentUser(client,data.user):null;
    const authenticatedEmail=String(data.user?.email||'').trim().toLowerCase();
    if(error||!projection||authenticatedEmail!==handoff.email)throw new Error('SIGNUP_IDENTITY_REQUIRED');
    if(projection.active){
      response.headers.set('Location',managedWorkspaceDestination(projection.role));
      clearSignupCookie(response);
      return response;
    }
    response.headers.set('Location',redirectUrl(request,'/apply?step=details').toString());
    return response;
  }catch{
    if(client)await client.auth.signOut().catch(()=>undefined);
    return response;
  }
}
