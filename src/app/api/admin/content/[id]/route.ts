import {NextRequest} from 'next/server.js';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth';
import {hasPlatformPermission,PLATFORM_PERMISSIONS} from '@/lib/platform-admin.js';
import {createSupabaseAdminClient} from '@/lib/supabase-adapter.js';
import {redirectWith} from '@/lib/redirects';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser({allowLimited:true}),{id}=await params;
 if(!user||!hasPlatformPermission(user,PLATFORM_PERMISSIONS.TRUST)||!z.string().uuid().safeParse(id).success)return redirectWith(request,'/admin/reviews/content','error','You do not have access to that report.');
 if(!(await checkRateLimit(requestKey(request,'content-moderation')+':'+user.id,20,60000)).allowed)return redirectWith(request,'/admin/reviews/content','error','Please wait before trying again.');
 const body=await request.formData(),input=z.object({decision:z.enum(['HIDE','DISMISS','RESTORE']),note:z.string().trim().min(5).max(1000)}).safeParse({decision:body.get('decision'),note:body.get('note')});
 if(!input.success)return redirectWith(request,'/admin/reviews/content','error','Choose a decision and enter a review note.');
 const {error}=await createSupabaseAdminClient().rpc('moderate_content_report',{actor_user_id:user.id,target_report_id:id,decision:input.data.decision,note:input.data.note});
 return redirectWith(request,'/admin/reviews/content',error?'error':'success',error?'The report could not be changed. Refresh its current state.':'Content report reviewed.');
}
