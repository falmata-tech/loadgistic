import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {createSupabaseAdminClient} from '@/lib/supabase-adapter.js';
import {errorMessage} from '@/lib/errors';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser({allowLimited:true});if(!user||user.role!=='ADMIN')return NextResponse.json({ok:false,error:'Access denied.'},{status:403});
 try{const {id}=await params,form=await request.formData();const {error}=await createSupabaseAdminClient().rpc('assign_guest_support_agent',{actor_user_id:user.id,conversation_id:id,expected_assignee:String(form.get('expectedAssignee')||'')||null,target_user_id:String(form.get('assignee')||'')||null});if(error){if(error.message==='SUPPORT_AGENT_UNAVAILABLE')throw new Error('SUPPORT_ASSIGNEE_UNAVAILABLE');if(error.message==='SUPPORT_AGENT_AT_CAPACITY')throw new Error('SUPPORT_ASSIGNEE_AT_CAPACITY');throw new Error(error.message);}return NextResponse.json({ok:true});}
 catch(error){return NextResponse.json({ok:false,error:errorMessage(error)},{status:400});}
}
