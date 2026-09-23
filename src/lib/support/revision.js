import {createSupabaseAdminClient} from '../supabase-adapter.js';
/** @param {{actorId?:string|null,conversationId:string,guest?:boolean,emailDigest?:string|null,markRead?:boolean}} input */
export async function supportConversationRevision({actorId=null,conversationId,guest=false,emailDigest=null,markRead=false}){
 const {data,error}=await createSupabaseAdminClient().rpc('support_conversation_revision',{
  actor_user_id:actorId,target_id:conversationId,guest,requested_digest:emailDigest,mark_read:markRead
 });
 if(error||typeof data!=='string')throw new Error(error?.message==='NOT_FOUND'?'NOT_FOUND':'SUPPORT_REVISION_UNAVAILABLE');
 return data;
}
