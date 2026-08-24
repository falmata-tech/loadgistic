import { NextRequest, NextResponse } from 'next/server.js';
import { MANAGED_AUTH_ERROR, managedWorkspaceDestination } from '@/lib/auth-flow.js';
import { getManagedCurrentUser } from '@/lib/identity/supabase';
import { redirectUrl } from '@/lib/redirects';
import { usesSupabaseAuth } from '@/lib/supabase/config';
import { createSupabaseRouteClient } from '@/lib/supabase/route';

export const runtime='nodejs';

function failed(request:NextRequest) {
  const location=redirectUrl(request,'/login');
  location.searchParams.set('error',MANAGED_AUTH_ERROR);
  const response=NextResponse.redirect(location,303);
  response.headers.set('Cache-Control','no-store');
  return response;
}

export async function GET(request:NextRequest) {
  const query=request.nextUrl.searchParams;
  const code=query.get('code')||'';
  const flowId=query.get('sb_flow_id')||'';
  if(!usesSupabaseAuth()||query.has('error')||!code||code.length>4096)return failed(request);
  if(flowId&&(flowId.length>256||!/^[A-Za-z0-9_-]+$/.test(flowId)))return failed(request);

  const response=failed(request);
  let client:ReturnType<typeof createSupabaseRouteClient>|null=null;
  try{
    client=createSupabaseRouteClient(request,response);
    const {data,error}=await client.auth.exchangeCodeForSession(code,flowId?{flowId}:undefined);
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
