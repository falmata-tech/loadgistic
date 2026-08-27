import { NextRequest, NextResponse } from 'next/server.js';
import { MANAGED_AUTH_ERROR, MANAGED_AUTH_UNAVAILABLE, isNumericEmailOtp, managedWorkspaceDestination, normalizeManagedAuthEmail } from '@/lib/auth-flow.js';
import { getManagedCurrentUser } from '@/lib/identity/supabase';
import { checkRateLimit, requestKey } from '@/lib/rate-limit';
import { redirectUrl, text } from '@/lib/redirects';
import { usesSupabaseAuth } from '@/lib/supabase/config';
import { createSupabaseRouteClient } from '@/lib/supabase/route';

export const runtime='nodejs';

function failed(request:NextRequest,message=MANAGED_AUTH_ERROR) {
  const location=redirectUrl(request,'/login');
  location.searchParams.set('step','code');
  location.searchParams.set('error',message);
  return NextResponse.redirect(location,303);
}

export async function POST(request:NextRequest) {
  if(!usesSupabaseAuth())return failed(request,MANAGED_AUTH_UNAVAILABLE);
  const form=await request.formData();
  const email=normalizeManagedAuthEmail(text(form,'email'));
  const token=text(form,'code');
  if(!email||!isNumericEmailOtp(token))return failed(request);
  const clientRate=await checkRateLimit(requestKey(request,'managed-email-otp-verify'),12,10*60_000);
  const accountRate=await checkRateLimit(`managed-email-otp-verify:${email}`,6,10*60_000);
  if(!clientRate.allowed||!accountRate.allowed)return failed(request,'Please wait before trying another code.');

  const response=failed(request);
  response.headers.set('Cache-Control','no-store');
  let client:ReturnType<typeof createSupabaseRouteClient>|null=null;
  try{
    client=createSupabaseRouteClient(request,response);
    const {data,error}=await client.auth.verifyOtp({email,token,type:'email'});
    const projection=!error&&data.user?await getManagedCurrentUser(client,data.user):null;
    if(error||!projection||!projection.active){
      await client.auth.signOut();
      return response;
    }
    response.headers.set('Location',managedWorkspaceDestination(projection.role));
    return response;
  }catch{
    if(client)await client.auth.signOut().catch(()=>undefined);
    return response;
  }
}
