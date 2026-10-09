import {z} from 'zod';
import {mobileBody,mobileClient,mobileFailure,mobileJson,MobileError} from '@/lib/mobile/server';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
import {createSessionToken,privateContactDigest,verifySessionToken} from '@/lib/security.js';
import {accountDeletionStatus,requestAccountDeletion} from '@/lib/privacy/account-deletion';
export const runtime='nodejs';
const command=z.discriminatedUnion('step',[
 z.object({step:z.literal('REQUEST'),email:z.string().trim().toLowerCase().email().max(254)}).strict(),
 z.object({step:z.literal('CONFIRM'),email:z.string().trim().toLowerCase().email().max(254),handoff:z.string().max(2048),code:z.string().regex(/^\d{6}$/),confirm:z.literal('DELETE')}).strict(),
 z.object({step:z.literal('STATUS'),receipt:z.string().max(2048)}).strict(),
]);
export async function POST(request:Request){
 try{
  const parsed=command.safeParse(await mobileBody(request));if(!parsed.success)throw new MobileError(400,'INVALID_INPUT','Check your email and deletion confirmation.');
  const input=parsed.data;
  const rate=await checkRateLimit(requestKey(request,'account-deletion-'+input.step.toLowerCase()),input.step==='STATUS'?30:8,600000);
  if(!rate.allowed)throw new MobileError(429,'PLEASE_WAIT','Please wait before trying again.');
  if(input.step==='STATUS'){
   const match=String(verifySessionToken(input.receipt)?.sub||'').match(/^account-deletion-status:([a-f0-9-]{36})$/);
   if(!match)throw new MobileError(401,'RECEIPT_EXPIRED','Verify your email again to check the request.');
   return mobileJson({request:await accountDeletionStatus(match[1])});
  }
  const digest=privateContactDigest(input.email),limit=await checkRateLimit('account-deletion-email:'+digest,input.step==='REQUEST'?4:6,600000);
  if(!limit.allowed)throw new MobileError(429,'PLEASE_WAIT','Please wait before trying again.');
  const client=mobileClient();
  if(input.step==='REQUEST'){
   // Same response for missing/inactive accounts. Never create an identity here.
   await client.auth.signInWithOtp({email:input.email,options:{shouldCreateUser:false}}).catch(()=>undefined);
   return mobileJson({handoff:createSessionToken('account-deletion-verify:'+digest,900)});
  }
  if(verifySessionToken(input.handoff)?.sub!=='account-deletion-verify:'+digest)throw new MobileError(400,'INVALID_CODE','Request a fresh code for this account.');
  const verified=await client.auth.verifyOtp({email:input.email,token:input.code,type:'email'});
  try{
   if(verified.error||!verified.data.session||!verified.data.user||verified.data.user.email?.toLowerCase()!==input.email)throw new MobileError(401,'INVALID_CODE','The code is incorrect or expired.');
   const status=await requestAccountDeletion(verified.data.user.id);
   return mobileJson({request:status,receipt:createSessionToken('account-deletion-status:'+verified.data.user.id,30*86400)});
  }finally{if(verified.data.session)await client.auth.signOut({scope:'local'}).catch(()=>undefined);}
 }catch(error){return mobileFailure(error);}
}
