import { NextRequest, NextResponse } from 'next/server.js';
import { MANAGED_AUTH_ERROR, managedWorkspaceDestination } from '@/lib/auth-flow.js';
import { getManagedCurrentUser } from '@/lib/identity/supabase';
import {completeManagedProviderSignup,MANAGED_SIGNUP_COOKIE,MANAGED_SIGNUP_ERROR} from '@/lib/provider-signup.js';
import { redirectUrl } from '@/lib/redirects';
import { usesSupabaseAuth } from '@/lib/supabase/config';
import { createSupabaseRouteClient } from '@/lib/supabase/route';

export const runtime='nodejs';

function failed(request:NextRequest,signup=false) {
  const location=redirectUrl(request,signup?'/apply':'/login');
  location.searchParams.set('error',signup?MANAGED_SIGNUP_ERROR:MANAGED_AUTH_ERROR);
  const response=NextResponse.redirect(location,303);
  response.headers.set('Cache-Control','no-store');
  if(signup)response.cookies.set(MANAGED_SIGNUP_COOKIE,'',{
    httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0
  });
  return response;
}

export async function GET(request:NextRequest) {
  const query=request.nextUrl.searchParams;
  const code=query.get('code')||'';
  const flowId=query.get('sb_flow_id')||'';
  const signupToken=request.cookies.get(MANAGED_SIGNUP_COOKIE)?.value||'';
  const signup=Boolean(signupToken);
  if(!usesSupabaseAuth()||query.has('error')||!code||code.length>4096)return failed(request,signup);
  if(flowId&&(flowId.length>256||!/^[A-Za-z0-9_-]+$/.test(flowId)))return failed(request,signup);

  const response=failed(request,signup);
  let client:ReturnType<typeof createSupabaseRouteClient>|null=null;
  try{
    client=createSupabaseRouteClient(request,response);
    const {data,error}=await client.auth.exchangeCodeForSession(code,flowId?{flowId}:undefined);
    let projection=!error&&data.user?await getManagedCurrentUser(client,data.user):null;
    if(!error&&data.user&&!projection?.active&&signupToken){
      await completeManagedProviderSignup(data.user.id,signupToken);
      projection=await getManagedCurrentUser(client,data.user);
    }
    if(error||!projection||!projection.active){
      await client.auth.signOut();
      return response;
    }
    response.cookies.set(MANAGED_SIGNUP_COOKIE,'',{
      httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0
    });
    response.headers.set('Location',managedWorkspaceDestination(projection.role));
    return response;
  }catch{
    if(client)await client.auth.signOut().catch(()=>undefined);
    return response;
  }
}
