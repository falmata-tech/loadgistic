import {NextRequest,NextResponse} from 'next/server.js';
import {createSupabaseRouteClient} from '@/lib/supabase/route';
import {acceptFleetInvitation} from '@/lib/fleet-driver-management';
import {MANAGED_SIGNUP_COOKIE} from '@/lib/provider-signup.js';
import {errorMessage} from '@/lib/errors';
import {redirectUrl,text} from '@/lib/redirects';

export async function POST(request:NextRequest){
  const response=NextResponse.redirect(redirectUrl(request,'/join-fleet'),303);
  response.headers.set('Cache-Control','no-store');
  const client=createSupabaseRouteClient(request,response);
  const {data,error}=await client.auth.getUser();
  if(error||!data.user){response.headers.set('Location',redirectUrl(request,'/login').toString());return response;}
  try{
    await acceptFleetInvitation(data.user.id,text(await request.formData(),'invitationId'));
    response.cookies.set(MANAGED_SIGNUP_COOKIE,'',{path:'/',maxAge:0,httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'});
    response.headers.set('Location',redirectUrl(request,'/app/home').toString());
  }catch(failure){
    const url=redirectUrl(request,'/join-fleet');url.searchParams.set('error',errorMessage(failure));
    response.headers.set('Location',url.toString());
  }
  return response;
}
