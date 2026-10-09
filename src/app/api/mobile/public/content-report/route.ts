import {z} from 'zod';
import {mobileBody,mobileFailure,mobileJson,MobileError} from '@/lib/mobile/server';
import {createSupabaseAdminClient} from '@/lib/supabase-adapter.js';
import {privateContactDigest} from '@/lib/security.js';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
export const runtime='nodejs';
const command=z.object({handle:z.string().regex(/^[a-z0-9][a-z0-9_-]{1,63}$/),reporter:z.string().uuid(),category:z.enum(['PROFILE','PICTURE','REVIEW','OTHER']),detail:z.string().trim().min(5).max(1000),reviewId:z.string().uuid().optional()}).strict();
export async function POST(request:Request){try{
 const parsed=command.safeParse(await mobileBody(request));if(!parsed.success)throw new MobileError(400,'INVALID_INPUT','Choose a reason and describe the content you are reporting.');
 const c=parsed.data,digest=privateContactDigest('content-reporter:'+c.reporter);
 const limits=await Promise.all([checkRateLimit(requestKey(request,'public-content-report'),8,600000),checkRateLimit('content-reporter:'+digest,4,600000)]);
 if(limits.some(value=>!value.allowed))throw new MobileError(429,'PLEASE_WAIT','Please wait before sending another report.');
 const {error}=await createSupabaseAdminClient().rpc('submit_content_report',{provider_handle:c.handle,visitor_digest:digest,report_category:c.category,report_detail:c.detail,target_review_id:c.reviewId||null});
 if(error)throw new MobileError(400,'REPORT_UNAVAILABLE','This content cannot be reported right now. Try again.');
 return mobileJson({recorded:true});
 }catch(error){return mobileFailure(error);}}
