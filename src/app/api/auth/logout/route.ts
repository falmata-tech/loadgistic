import { NextRequest, NextResponse } from 'next/server.js';
import { signOutSupabaseRoute } from '@/lib/supabase/logout';

export const runtime='nodejs';

export async function POST(request: NextRequest) {
  const destination=new URLSearchParams({success:'You have been logged out'});
  // A fixed relative destination keeps the browser's origin behind proxies.
  // An internal request host would break the CSP-protected form navigation.
  const response = new NextResponse(null,{status:303,headers:{Location:`/login?${destination}`}});
  const result=await signOutSupabaseRoute(request,response);
  if(!result.remoteRevocationConfirmed){
    destination.delete('success');
    destination.set('error','Signed out of this browser. We could not confirm sign-out on other devices.');
    response.headers.set('Location',`/login?${destination}`);
  }
  response.headers.set('Cache-Control','no-store');
  return response;
}
