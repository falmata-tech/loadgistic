import {NextRequest,NextResponse} from 'next/server.js';
import {createSupabaseRouteClient} from '@/lib/supabase/route';
import {redirectUrl} from '@/lib/redirects';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
import {accountSecurityActor,accountDeactivationBlockers,deactivateOwnAccount} from '@/lib/identity/account-security';
import {ACCOUNT_SECURITY_COOKIE,ACCOUNT_SECURITY_TTL,parseAccountSecurityRequest,accountSecurityHandoff,readAccountSecurityHandoff} from '@/lib/account-security.js';

export const runtime='nodejs';
const cookieOptions={httpOnly:true,sameSite:'lax' as const,secure:process.env.NODE_ENV==='production',path:'/',maxAge:ACCOUNT_SECURITY_TTL};
export async function POST(request:NextRequest,{params}:{params:Promise<{step:string}>}){
 const carrier=NextResponse.json({ok:false});const client=createSupabaseRouteClient(request,carrier);
 const finish=(payload:unknown,status=200)=>{const response=NextResponse.json(payload,{status,headers:{'Cache-Control':'private, no-store'}});for(const cookie of carrier.cookies.getAll())response.cookies.set(cookie);return response;};
 try{
  const {step}=await params;if(!['request','confirm','check'].includes(step))return finish({ok:false,error:'That account action is unavailable.'},404);
  const {user}=await accountSecurityActor(client);
  const blockers=await accountDeactivationBlockers(user.id);
  const body=await request.json();const {code,...raw}=body;
  const input=parseAccountSecurityRequest(raw);const target=input.action==='EMAIL'?input.email:'DEACTIVATE';
  if(step==='request'&&code!==undefined)throw new Error('INVALID_ACCOUNT_SECURITY');
  const rate=await checkRateLimit(`${requestKey(request,`account-security-${step}`)}:${user.id}`,step==='request'?4:8,10*60_000);
  if(!rate.allowed)return finish({ok:false,error:'Please wait before requesting or trying another code.'},429);
  if(step==='request'){
   if(input.action==='EMAIL'&&input.email===user.email.toLowerCase())throw new Error('ACCOUNT_EMAIL_UNCHANGED');
   if(input.action==='DEACTIVATE'){
    if(blockers.length)return finish({ok:false,error:'Resolve your active work before deactivating the account.',blockers},409);
   }
   const {error}=await client.auth.signInWithOtp({email:user.email,options:{shouldCreateUser:false}});
   if(error)throw new Error('ACCOUNT_CODE_UNAVAILABLE');
   carrier.cookies.set(ACCOUNT_SECURITY_COOKIE,accountSecurityHandoff(user.id,input.action,target),cookieOptions);
   return finish({ok:true,stage:'CURRENT_EMAIL',message:'Enter the code sent to your current login email.'});
  }
  if(step==='check'){
   if(input.action!=='EMAIL'||!readAccountSecurityHandoff(request.cookies.get(ACCOUNT_SECURITY_COOKIE)?.value,user.id,'EMAIL',target,'EMAIL_PENDING'))throw new Error('ACCOUNT_REAUTH_REQUIRED');
   const {data,error}=await client.auth.getUser();if(error||data.user?.id!==user.id)throw new Error('ACCOUNT_SECURITY_UNAVAILABLE');
   const complete=data.user.email?.toLowerCase()===input.email&&!data.user.new_email;
   if(complete)carrier.cookies.set(ACCOUNT_SECURITY_COOKIE,'',{...cookieOptions,maxAge:0});
   return finish({ok:true,stage:complete?'COMPLETE':'EMAIL_PENDING',message:complete?'Login email changed.':'Open the confirmation links in your inboxes, then check again.'});
  }
  if(!readAccountSecurityHandoff(request.cookies.get(ACCOUNT_SECURITY_COOKIE)?.value,user.id,input.action,target)||typeof code!=='string'||!/^\d{6}$/.test(code))throw new Error('ACCOUNT_REAUTH_REQUIRED');
  const verified=await client.auth.verifyOtp({email:user.email,token:code,type:'email'});
  if(verified.error||verified.data.user?.id!==user.id)throw new Error('ACCOUNT_CODE_INVALID');
  await accountSecurityActor(client);
  if(input.action==='DEACTIVATE'){
   await deactivateOwnAccount(user.id);
   carrier.cookies.set(ACCOUNT_SECURITY_COOKIE,'',{...cookieOptions,maxAge:0});
   await client.auth.signOut({scope:'global'}).catch(()=>undefined);
   return finish({ok:true,stage:'DEACTIVATED',next:'/login?success=Account+deactivated.+Your+history+is+retained.'});
  }
  const {error}=await client.auth.updateUser({email:input.email},{emailRedirectTo:redirectUrl(request,'/api/account/security/callback').href});
  if(error)throw new Error('ACCOUNT_EMAIL_UPDATE_UNCONFIRMED');
  carrier.cookies.set(ACCOUNT_SECURITY_COOKIE,accountSecurityHandoff(user.id,'EMAIL',input.email,'EMAIL_PENDING'),cookieOptions);
  return finish({ok:true,stage:'EMAIL_PENDING',message:'Open the email-change confirmation links sent to your inboxes, then check the change here.'});
 }catch(error){
  const code=error instanceof Error?error.message:'';
  const messages:Record<string,string>={FORBIDDEN:'Sign in to an active provider account to continue.',INVALID_ACCOUNT_SECURITY:'Check the requested action and email address.',ACCOUNT_EMAIL_UNCHANGED:'Enter a different login email.',ACCOUNT_REAUTH_REQUIRED:'Request a fresh code for this account action.',ACCOUNT_CODE_INVALID:'That code could not be verified. Request a new code if needed.',ACCOUNT_HAS_ACTIVE_WORK:'Resolve your active work before deactivating the account.',ACCOUNT_EMAIL_UPDATE_UNCONFIRMED:'We could not confirm the email-change request. Check your account and inboxes before trying again.',ACCOUNT_CODE_UNAVAILABLE:'The code could not be sent. Try again shortly.'};
  return finish({ok:false,error:messages[code]||'Account security changes are temporarily unavailable.'},code==='FORBIDDEN'?403:code==='ACCOUNT_HAS_ACTIVE_WORK'?409:400);
 }
}
