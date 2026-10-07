import { mobileActor, mobileBody, mobileClient, mobileFailure, mobileJson, MobileError } from '@/lib/mobile/server';
import { mobileBearer } from '@/lib/mobile/identity-policy.js';
import { nativeSecurityCommand, nativeSecurityHandoff, readNativeSecurityHandoff } from '@/lib/mobile/account-security-contract.js';
import { accountDeactivationBlockers, deactivateOwnAccount } from '@/lib/identity/account-security';
import { checkRateLimit, requestKey } from '@/lib/rate-limit';
import { managedAuthCallbackUrl } from '@/lib/auth-flow.js';
export const runtime = 'nodejs';
async function authIdentity(request: Request) {
 const user = await mobileActor(request, true), client = mobileClient(), token = mobileBearer(request.headers.get('authorization'))!;
 const current = await client.auth.getUser(token);
 if(current.error || current.data.user?.id !== user.id || !current.data.user.email) throw new MobileError(401,'SIGN_IN_REQUIRED','Sign in again to manage account security.');
 return { user, client, auth: current.data.user };
}
export async function GET(request: Request) {
 try { const { user, auth } = await authIdentity(request), pendingEmail = auth.new_email || '';
  return mobileJson({email:auth.email, pendingEmail, blockers:await accountDeactivationBlockers(user.id),
   pendingHandoff:pendingEmail?nativeSecurityHandoff(user.id,{action:'EMAIL',email:pendingEmail},'EMAIL_PENDING'):''});
 } catch(error){return mobileFailure(error);}
}
export async function POST(request: Request) {
 try { const { user, client, auth } = await authIdentity(request), input = nativeSecurityCommand.safeParse(await mobileBody(request));
  if(!input.success) throw new MobileError(400,'INVALID_INPUT','Check the requested action and verification code.');
  const {step,operation}=input.data;
  const rate=await checkRateLimit(`${requestKey(request,`account-security-${step.toLowerCase()}`)}:${user.id}`,step==='REQUEST'?4:8,600000);
  if(!rate.allowed)throw new MobileError(429,'PLEASE_WAIT','Please wait before requesting or trying another code.');
  if(step==='CHECK'){
   if(!readNativeSecurityHandoff(input.data.handoff,user.id,operation,'EMAIL_PENDING'))throw new MobileError(400,'REAUTH_REQUIRED','Refresh account security and check again.');
   return mobileJson({stage:auth.email?.toLowerCase()===operation.email&&!auth.new_email?'COMPLETE':'EMAIL_PENDING'});
  }
  if(operation.action==='DEACTIVATE'&&(await accountDeactivationBlockers(user.id)).length)throw new MobileError(409,'ACTIVE_WORK','Resolve the listed active work before deactivating your account.');
  if(step==='REQUEST'){
   if(operation.action==='EMAIL'&&operation.email===auth.email?.toLowerCase())throw new MobileError(400,'EMAIL_UNCHANGED','Enter a different login email.');
   const sent=await client.auth.signInWithOtp({email:auth.email!,options:{shouldCreateUser:false}});
   if(sent.error)throw new MobileError(503,'CODE_UNAVAILABLE','The code could not be sent. Try again shortly.');
   return mobileJson({stage:'CURRENT_EMAIL',handoff:nativeSecurityHandoff(user.id,operation)});
  }
  if(!readNativeSecurityHandoff(input.data.handoff,user.id,operation))throw new MobileError(400,'REAUTH_REQUIRED','Request a fresh code for this account action.');
  const verified=await client.auth.verifyOtp({email:auth.email!,token:input.data.code,type:'email'});
  try {
   if(verified.error||verified.data.user?.id!==user.id||!verified.data.session)throw new MobileError(400,'INVALID_CODE','The code is incorrect or expired. Request a fresh code if needed.');
   if(operation.action==='DEACTIVATE'){
    try {await deactivateOwnAccount(user.id);}catch(error){if(error instanceof Error&&error.message==='ACCOUNT_HAS_ACTIVE_WORK')throw new MobileError(409,'ACTIVE_WORK','Resolve your active work before deactivating.');throw error;}
    await client.auth.signOut({scope:'global'}).catch(()=>undefined);
    return mobileJson({stage:'DEACTIVATED'});
   }
   const callback=managedAuthCallbackUrl({requestUrl:request.url});if(!callback)throw new MobileError(503,'UNAVAILABLE','Account security is temporarily unavailable.');
   const changed=await client.auth.updateUser({email:operation.email},{emailRedirectTo:new URL('/login',callback).toString()});
   if(changed.error)throw new MobileError(409,'EMAIL_UNCONFIRMED','The email-change request was not confirmed. Refresh account security and check your inboxes before trying again.');
   return mobileJson({stage:'EMAIL_PENDING',handoff:nativeSecurityHandoff(user.id,operation,'EMAIL_PENDING')});
  } finally {if(verified.data.session)await client.auth.signOut({scope:'local'}).catch(()=>undefined);}
 } catch(error){return mobileFailure(error);}
}
