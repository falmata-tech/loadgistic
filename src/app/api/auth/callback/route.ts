import { NextRequest, NextResponse } from 'next/server.js';
import { MANAGED_AUTH_ERROR, managedWorkspaceDestination } from '@/lib/auth-flow.js';
import { getManagedCurrentUser } from '@/lib/identity/supabase';
import {MANAGED_SIGNUP_COOKIE,MANAGED_SIGNUP_ERROR,readProviderSignupHandoff} from '@/lib/provider-signup.js';
import { redirectUrl } from '@/lib/redirects';
import { createSupabaseRouteClient } from '@/lib/supabase/route';

export const runtime='nodejs';

function failed(request:NextRequest,signup=false) {
  const location=redirectUrl(request,signup?'/apply':'/login');
  location.searchParams.set('error',signup?MANAGED_SIGNUP_ERROR:MANAGED_AUTH_ERROR);
  const response=NextResponse.redirect(location,303);
  response.headers.set('Cache-Control','no-store');
  return response;
}

function clearSignupCookie(response:NextResponse){
  response.cookies.set(MANAGED_SIGNUP_COOKIE,'',{
    httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0
  });
}

function failedAndCleared(request:NextRequest,signup=false){
  const response=failed(request,signup);
  if(signup)clearSignupCookie(response);
  return response;
}

export async function GET(request:NextRequest) {
  const query=request.nextUrl.searchParams;
  const code=query.get('code')||'';
  const flowId=query.get('sb_flow_id')||'';
  const signupHandoff=readProviderSignupHandoff(request.cookies.get(MANAGED_SIGNUP_COOKIE)?.value||'');
  const signup=Boolean(signupHandoff);
  if(query.has('error')||!code||code.length>4096)return failedAndCleared(request,signup);
  if(flowId&&(flowId.length>256||!/^[A-Za-z0-9_-]+$/.test(flowId)))return failedAndCleared(request,signup);

  const response=failed(request,signup);
  let client:ReturnType<typeof createSupabaseRouteClient>|null=null;
  try{
    client=createSupabaseRouteClient(request,response);
    const {data,error}=await client.auth.exchangeCodeForSession(code,flowId?{flowId}:undefined);
    const projection=!error&&data.user?await getManagedCurrentUser(client,data.user):null;
    const authenticatedEmail=String(data.user?.email||'').trim().toLowerCase();
    if(signupHandoff?.email&&authenticatedEmail!==signupHandoff.email){
      await client.auth.signOut();
      clearSignupCookie(response);
      return response;
    }
    if(!error&&data.user&&projection&&!projection.active&&signupHandoff){
      response.headers.set('Location',redirectUrl(request,'/apply?step=details').toString());
      return response;
    }
    if(error||!projection||!projection.active){
      await client.auth.signOut();
      if(signup)clearSignupCookie(response);
      return response;
    }
    clearSignupCookie(response);
    response.headers.set('Location',managedWorkspaceDestination(projection.role));
    return response;
  }catch{
    if(client)await client.auth.signOut().catch(()=>undefined);
    if(signup)clearSignupCookie(response);
    return response;
  }
}
