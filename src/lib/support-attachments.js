import path from 'node:path';
import {z} from 'zod';
import {createSupabaseAdminClient} from './supabase-adapter.js';
import {createPrivateUploadReference,storePrivateUpload,removePrivateUpload,readPrivateUpload} from './private-storage.js';
import {privateUploadMaxBytes} from './upload-policy.js';

const uuid=z.string().uuid();
const rows=z.array(z.object({id:uuid,file_path:z.string()})).max(20);
const errors=['NOT_FOUND','SUPPORT_CONVERSATION_CLOSED','INVALID_SUPPORT_MESSAGE','SUPPORT_MESSAGE_RATE_LIMITED','SUPPORT_UPLOAD_BUSY'];
async function command(client,name,args){const {data,error}=await client.rpc(name,args);if(error)throw new Error(errors.includes(error.message)?error.message:'SUPPORT_ATTACHMENT_FAILED');return data;}
export function supportAttachmentInput(body,file){
  const message=String(body||'').trim();if(!message||message.length>2000)throw new Error('INVALID_SUPPORT_MESSAGE');
  if(!file||typeof file.arrayBuffer!=='function'||!file.size)throw new Error('ATTACHMENT_REQUIRED');
  if(file.size>privateUploadMaxBytes())throw new Error('FILE_TOO_LARGE');
  const mimeType=String(file.type||'').toLowerCase();
  if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(mimeType))throw new Error('UNSUPPORTED_FILE_TYPE');
  const name=path.basename(String(file.name||'attachment')).replace(/[^a-zA-Z0-9._ -]/g,'_').slice(0,160)||'attachment';
  return {body:message,mimeType,name,size:file.size};
}
export async function sendSupportAttachment(user,conversationId,body,file){
  const input=supportAttachmentInput(body,file);uuid.parse(conversationId);uuid.parse(user.id);
  const client=createSupabaseAdminClient();const reference=createPrivateUploadReference('member-support',input.mimeType);
  // Reservation authorizes persisted actor/conversation state before any Storage write.
  const id=uuid.parse(await command(client,'reserve_support_attachment',{actor_user_id:user.id,target_conversation_id:conversationId,
    command:{file_path:reference,original_name:input.name,mime_type:input.mimeType,size_bytes:input.size}}));
  let uploaded=false;
  try{
    await storePrivateUpload(file,'member-support',{reference,timeoutMs:30000});uploaded=true;
    await command(client,'send_support_attachment_message',{actor_user_id:user.id,target_conversation_id:conversationId,upload_id:id,message_body:input.body});
  }catch(error){
    // An ATTACHED row survives a lost commit response. An unacknowledged Storage
    // write retains its reservation for the one-hour grace period before deletion.
    await command(client,'discard_support_attachment',{actor_user_id:user.id,upload_id:id,upload_completed:uploaded}).catch(()=>undefined);
    await cleanupSupportAttachments(1).catch(()=>undefined);throw error;
  }
}
export async function readSupportAttachment(user,conversationId,attachmentId){
  if(!uuid.safeParse(conversationId).success||!uuid.safeParse(attachmentId).success)throw new Error('NOT_FOUND');
  const data=await command(createSupabaseAdminClient(),'support_attachment_file',{actor_user_id:user.id,target_conversation_id:conversationId,attachment_id:attachmentId});
  if(!data)throw new Error('NOT_FOUND');
  const file=z.object({file_path:z.string(),mime_type:z.enum(['image/jpeg','image/png','image/webp','application/pdf']),original_name:z.string().max(160)}).parse(data);
  const bytes=await readPrivateUpload(file.file_path,{timeoutMs:30000});if(!bytes)throw new Error('NOT_FOUND');
  return {bytes,mimeType:file.mime_type,originalName:file.original_name};
}
export async function cleanupSupportAttachments(limit=20,{client=createSupabaseAdminClient(),remove=reference=>removePrivateUpload(reference,{timeoutMs:30000})}={}){
  const data=await command(client,'claim_support_attachment_cleanup',{requested_limit:Math.max(1,Math.min(20,Math.trunc(Number(limit))||20))});
  const claimed=rows.parse(data);let deleted=0,failed=0;
  for(const row of claimed){try{
    await remove(row.file_path);const result=await client.from('support_attachments').delete().eq('id',row.id).eq('state','DELETING');
    if(result.error)throw new Error('SUPPORT_ATTACHMENT_CLEANUP_FAILED');deleted++;
  }catch{failed++;}}
  return {attempted:claimed.length,deleted,failed};
}
