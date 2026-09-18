import {NextRequest,NextResponse} from 'next/server.js';
import {createSupabaseRouteClient} from '@/lib/supabase/route';
import {redirectUrl} from '@/lib/redirects';
import {ACCOUNT_SECURITY_COOKIE,accountSecurityIdentity} from '@/lib/account-security.js';
import {privateContactDigest} from '@/lib/security.js';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 const target=redirectUrl(request,'/app/more');target.searchParams.set('success','Check both email inboxes to finish the change.');
 const response=NextResponse.redirect(target,303);response.headers.set('Cache-Control','private, no-store');
 const identity=accountSecurityIdentity(request.cookies.get(ACCOUNT_SECURITY_COOKIE)?.value);
 if(!identity||identity.action!=='EMAIL'||identity.phase!=='EMAIL_PENDING'){
  response.headers.set('Location',redirectUrl(request,'/login?error=Sign+in+to+check+your+confirmed+email+change.').href);return response;
 }
 const client=createSupabaseRouteClient(request,response);
 try{
  const code=request.nextUrl.searchParams.get('code');
  if(code){const exchanged=await client.auth.exchangeCodeForSession(code);if(exchanged.error||exchanged.data.user?.id!==identity.actorId)throw new Error('ACCOUNT_CALLBACK_DENIED');}
  const {data,error}=await client.auth.getUser();
  if(error||data.user?.id!==identity.actorId)throw new Error('ACCOUNT_CALLBACK_DENIED');
  if(data.user.email&&!data.user.new_email&&privateContactDigest(data.user.email.toLowerCase())===identity.targetDigest){
   target.searchParams.set('success','Login email changed.');response.headers.set('Location',target.href);
   response.cookies.set(ACCOUNT_SECURITY_COOKIE,'',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0});
  }
 }catch{
  await client.auth.signOut({scope:'local'}).catch(()=>undefined);
  response.headers.set('Location',redirectUrl(request,'/login?error=Sign+in+to+check+your+confirmed+email+change.').href);
 }
 return response;
}
