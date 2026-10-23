import {z} from 'zod';
import {createSupabaseAdminClient} from '../supabase-adapter.js';
import {removePrivateUpload} from '../private-storage.js';
import {runAccountErasure} from './erasure-workflow.js';
export const deletionStatus=z.object({id:z.string().uuid(),status:z.enum(['REQUESTED','HELD','ERASING','COMPLETED']),requestedAt:z.string(),reviewDueAt:z.string(),retentionReason:z.string().nullable(),reviewAfter:z.string().nullable(),completedAt:z.string().nullable()});
export type DeletionStatus=z.infer<typeof deletionStatus>;
export async function requestAccountDeletion(actorId:string):Promise<DeletionStatus>{
 const {data,error}=await createSupabaseAdminClient().rpc('request_account_deletion',{actor_user_id:actorId});
 if(error)throw Error('DELETION_REQUEST_UNAVAILABLE');return deletionStatus.parse(data);
}
export async function accountDeletionStatus(actorId:string):Promise<DeletionStatus|null>{
 const {data,error}=await createSupabaseAdminClient().rpc('account_deletion_status',{actor_user_id:actorId});
 if(error)throw Error('DELETION_STATUS_UNAVAILABLE');return data===null?null:deletionStatus.parse(data);
}
export async function eraseRequestedAccount(actorId:string,requestId:string){
 const client=createSupabaseAdminClient();
 const checked=async(name:string,args:Record<string,string>)=>{const {data,error}=await client.rpc(name,args);if(error)throw Error('ACCOUNT_ERASURE_UNAVAILABLE');return data;};
 return runAccountErasure({
  now:Date.now,
  prepare:async(actor:string,id:string)=>z.discriminatedUnion('status',[z.object({status:z.literal('ERASING'),subjectId:z.string().uuid(),authErased:z.boolean().optional()}),z.object({status:z.literal('HELD')}),z.object({status:z.literal('COMPLETED')})]).parse(await checked('prepare_account_erasure',{actor_user_id:actor,target_request_id:id})),
  files:async(id:string)=>{const {data,error}=await client.from('account_erasure_files').select('storage_path').eq('request_id',id).is('removed_at',null).limit(30);if(error)throw Error('ACCOUNT_ERASURE_UNAVAILABLE');return z.array(z.object({storage_path:z.string()})).parse(data);},
  removeFile:async(path:string)=>{await removePrivateUpload(path,{timeoutMs:4000});},
  markFileRemoved:async(id:string,path:string)=>{const {error}=await client.from('account_erasure_files').update({removed_at:new Date().toISOString()}).eq('request_id',id).eq('storage_path',path);if(error)throw Error('ACCOUNT_ERASURE_UNAVAILABLE');},
  pendingFiles:async(id:string)=>{const {count,error}=await client.from('account_erasure_files').select('request_id',{count:'exact',head:true}).eq('request_id',id).is('removed_at',null);if(error||count===null)throw Error('ACCOUNT_ERASURE_UNAVAILABLE');return count>0;},
  eraseAuth:async(subjectId:string)=>{if(!z.string().uuid().safeParse(subjectId).success)throw Error('ACCOUNT_ERASURE_UNAVAILABLE');const {error}=await client.auth.admin.deleteUser(subjectId,true);if(error)throw Error('ACCOUNT_AUTH_ERASURE_UNAVAILABLE');},
  finish:async(actor:string,id:string)=>deletionStatus.parse(await checked('finish_account_erasure',{actor_user_id:actor,target_request_id:id})),
 },actorId,requestId);
}
