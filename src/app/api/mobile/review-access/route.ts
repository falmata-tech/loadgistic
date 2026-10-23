import {z} from 'zod';
import {mobileBody,mobileClient,mobileFailure,mobileJson,MobileError,mobileSession} from '@/lib/mobile/server';
import {reviewAccountAllowed} from '@/lib/privacy/review-access.js';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
import {privateContactDigest} from '@/lib/security.js';
export const runtime='nodejs';
const command=z.object({email:z.string().trim().toLowerCase().email().max(254),password:z.string().min(8).max(256)}).strict();
export async function POST(request:Request){try{
 const input=command.safeParse(await mobileBody(request));if(!input.success)throw new MobileError(401,'REVIEW_ACCESS_DENIED','The review account could not sign in.');
 const limits=await Promise.all([checkRateLimit(requestKey(request,'review-login'),12,600000),checkRateLimit('review-login:'+privateContactDigest(input.data.email),6,600000)]);
 if(limits.some(value=>!value.allowed))throw new MobileError(429,'PLEASE_WAIT','Please wait before trying again.');
 const client=mobileClient(),result=await client.auth.signInWithPassword(input.data);
 try{
  if(result.error||!result.data.session||!result.data.user||result.data.user.app_metadata?.loadgistic_review!==true||!await reviewAccountAllowed(result.data.user.id))throw new MobileError(401,'REVIEW_ACCESS_DENIED','The review account could not sign in.');
  return mobileJson(await mobileSession(client,result.data.session));
 }catch(error){if(result.data.session)await client.auth.signOut({scope:'local'}).catch(()=>undefined);throw error;}
 }catch(error){return mobileFailure(error);}}
