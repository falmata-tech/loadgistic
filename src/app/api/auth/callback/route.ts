import { NextRequest, NextResponse } from 'next/server.js';
import { MANAGED_AUTH_ERROR, managedWorkspaceDestination } from '@/lib/auth-flow.js';
import { getManagedCurrentUser } from '@/lib/identity/supabase';
import {
  managedOAuthCallbackHandoff,readManagedOAuthHandoff,MANAGED_OAUTH_COOKIE
} from '@/lib/managed-oauth-flow.js';
import {
  managedProviderSignupEligible,MANAGED_SIGNUP_COOKIE,readProviderSignupHandoff
} from '@/lib/provider-signup.js';
import { redirectUrl } from '@/lib/redirects';
import { createSupabaseRouteClient } from '@/lib/supabase/route';

export const runtime='nodejs';

function failed(request:NextRequest) {
  const location=redirectUrl(request,'/login');
  location.searchParams.set('error',MANAGED_AUTH_ERROR);
  const response=NextResponse.redirect(location,303);
  response.headers.set('Cache-Control','no-store');
  return response;
}

function clearSignupCookie(response:NextResponse){
  response.cookies.set(MANAGED_SIGNUP_COOKIE,'',{
    httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0
  });
}

function clearOAuthCookie(response:NextResponse){
  response.cookies.set(MANAGED_OAUTH_COOKIE,'',{
    httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0
  });
}

function failedAndCleared(request:NextRequest){
  const response=failed(request);
  clearOAuthCookie(response);
  clearSignupCookie(response);
  return response;
}

export async function GET(request:NextRequest) {
  const query=request.nextUrl.searchParams;
  const code=query.get('code')||'';
  const flowId=query.get('sb_flow_id')||'';
  const signupHandoff=readProviderSignupHandoff(request.cookies.get(MANAGED_SIGNUP_COOKIE)?.value||'');
  const oauthToken=request.cookies.get(MANAGED_OAUTH_COOKIE)?.value||'';
  const pendingOAuth=readManagedOAuthHandoff(oauthToken);
  const oauthHandoff=managedOAuthCallbackHandoff(oauthToken,flowId);
  const oauthIntent=oauthHandoff?.intent||null;
  const accountAccess=pendingOAuth?.intent==='ACCESS'||oauthIntent==='ACCESS';
  const setupAllowed=oauthIntent==='ACCESS'&&Boolean(signupHandoff);
  if(query.has('error')||!code||code.length>4096)return failedAndCleared(request);
  if(!oauthHandoff||accountAccess&&!signupHandoff)return failedAndCleared(request);

  const response=failed(request);
  clearOAuthCookie(response);
  let client:ReturnType<typeof createSupabaseRouteClient>|null=null;
  try{
    client=createSupabaseRouteClient(request,response);
    const {data,error}=await client.auth.exchangeCodeForSession(code,{flowId:oauthHandoff.flowId});
    const projection=!error&&data.user?await getManagedCurrentUser(client,data.user):null;
    const authenticatedEmail=String(data.user?.email||'').trim().toLowerCase();
    if(signupHandoff?.email&&authenticatedEmail!==signupHandoff.email){
      await client.auth.signOut();
      clearSignupCookie(response);
      return response;
    }
    if(!error&&data.user&&projection?.active){
      clearSignupCookie(response);
      response.headers.set('Location',managedWorkspaceDestination(projection.role));
      return response;
    }
    if(!error&&data.user&&setupAllowed&&await managedProviderSignupEligible(data.user.id)){
      response.headers.set('Location',redirectUrl(request,'/apply?step=details').toString());
      return response;
    }
    if(error||!projection||!projection.active){
      await client.auth.signOut();
      clearSignupCookie(response);
      return response;
    }
    return response;
  }catch{
    if(client)await client.auth.signOut().catch(()=>undefined);
    clearSignupCookie(response);
    return response;
  }
}
