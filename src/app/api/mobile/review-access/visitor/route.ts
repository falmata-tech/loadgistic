import {z} from 'zod';
import {mobileBody,mobileClient,mobileFailure,mobileJson,MobileError,mobileVerifiedIdentity} from '@/lib/mobile/server';
import {issueReviewVisitor} from '@/lib/mobile/visitor-server';
import {reviewVisitorDigest} from '@/lib/privacy/review-access.js';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
export const runtime='nodejs';
export async function POST(request:Request){try{
 const actor=await mobileVerifiedIdentity(request),token=request.headers.get('authorization')?.slice(7);
 const {data,error}=await mobileClient(token).auth.getUser(token);
 if(error||data.user?.id!==actor.id||data.user?.app_metadata?.loadgistic_review!==true)throw new MobileError(403,'FORBIDDEN','This review access is unavailable.');
 const input=z.object({scope:z.enum(['tracking','capacity'])}).strict().safeParse(await mobileBody(request));
 if(!input.success)throw new MobileError(400,'INVALID_INPUT','Choose a valid view.');
 const rate=await checkRateLimit(requestKey(request,'review-visitor'),30,60000);
 if(!rate.allowed)throw new MobileError(429,'PLEASE_WAIT','Please wait before trying again.');
 if(!await reviewVisitorDigest(actor.id,input.data.scope))throw new MobileError(403,'FORBIDDEN','This review access is unavailable.');
 return mobileJson(issueReviewVisitor(input.data.scope,actor.id));
}catch(error){return mobileFailure(error);}}
