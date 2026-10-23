import {z} from 'zod';
import {createSupabaseAdminClient} from '../supabase-adapter.js';
import {directoryIdentity,directorySearch,BusinessDirectoryError} from './domain.js';
import type {BusinessDirectoryPort,BusinessDirectoryPage,BusinessDocumentsView,BusinessDocumentType} from './contracts';

export interface DirectoryRpcPort {rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:{message:string}|null}>}
const id=z.string().uuid(),type=z.enum(['IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS']);
const badge=z.object({type,verified:z.boolean(),expired:z.boolean(),reviewedAt:z.string().nullable(),expiresOn:z.string().nullable()}).strict();
const badges=z.array(badge).length(3).refine(items=>new Set(items.map(item=>item.type)).size===3);
const business=z.object({id,name:z.string(),handle:z.string(),kind:z.enum(['BROKER','SHIPPER','RECEIVER']),city:z.string().nullable(),managerName:z.string().nullable(),documents:badges}).strict();
const request=z.object({id,subject_type:z.literal('BUSINESS_WORKSPACE'),subject_id:id,verification_type:type,status:z.enum(['PENDING','APPROVED','MORE_INFO','REJECTED']),document_name:z.string(),submitted_at:z.string(),reviewed_at:z.string().nullable(),expires_on:z.string().nullable(),review_note:z.string().nullable(),has_file:z.boolean(),stale:z.boolean()}).strict();
const view=z.object({workspaceId:id,name:z.string(),handle:z.string(),managerName:z.string().nullable(),canManage:z.boolean(),documents:badges,subjects:z.array(z.object({subject_type:z.literal('BUSINESS_WORKSPACE'),subject_id:id,name:z.string(),type:z.string(),verification_types:z.array(type),vehicles:z.array(z.unknown()).length(0),approved_documents:z.array(z.object({verification_type:type,reviewed_at:z.string().nullable(),expires_on:z.string().nullable(),related_vehicle_id:z.null()}).strict())}).strict()).max(1),requests:z.array(request)}).strict();
const denied=['FORBIDDEN','INVALID_BUSINESS_INPUT','VERIFICATION_SUBJECT_CHANGED','BUSINESS_MANAGER_NAME_REQUIRED'];
export function supabaseBusinessDirectoryPort(client:DirectoryRpcPort=createSupabaseAdminClient()):BusinessDirectoryPort {
 async function rpc<T>(name:string,args:Record<string,unknown>,schema:z.ZodType<T>):Promise<T>{
  const {data,error}=await client.rpc(name,args);
  if(error)throw new BusinessDirectoryError(denied.find(code=>error.message.includes(code))||'BUSINESS_DIRECTORY_UNAVAILABLE');
  const parsed=schema.safeParse(data);if(!parsed.success)throw new BusinessDirectoryError('BUSINESS_DIRECTORY_UNAVAILABLE');return parsed.data;
 }
 return {
  async search(actorId,query,page):Promise<BusinessDirectoryPage>{
   directoryIdentity(actorId);const input=directorySearch(query,String(page)),pageSize=12;
   const schema=z.array(z.object({payload:business,total_count:z.union([z.number().int().nonnegative(),z.string().regex(/^\d+$/)])}).strict()).max(pageSize);
   const load=(offset:number)=>rpc('provider_business_directory',{actor_user_id:actorId,search_text:input.query,requested_offset:offset,requested_limit:pageSize},schema);
   let actualPage=input.page,rows=await load((actualPage-1)*pageSize);
   // Recover at most one bounded first page after removal/filter changes. Each
   // read repeats current provider authorization in PostgreSQL.
   if(actualPage>1&&!rows.length){actualPage=1;rows=await load(0);}
   const total=Number(rows[0]?.total_count||0);
   if(!Number.isSafeInteger(total)||rows.some(row=>Number(row.total_count)!==total))throw new BusinessDirectoryError('BUSINESS_DIRECTORY_UNAVAILABLE');
   return {items:rows.map(row=>row.payload),total,page:actualPage,pageSize,pageCount:Math.max(1,Math.ceil(total/pageSize))};
  },
  async documents(actorId,workspaceId):Promise<BusinessDocumentsView>{
   directoryIdentity(actorId);directoryIdentity(workspaceId);
   const data=await rpc('business_verification_center',{actor_user_id:actorId,target_workspace_id:workspaceId},view);
   if(data.workspaceId!==workspaceId||data.subjects.some(subject=>subject.subject_id!==workspaceId)||data.canManage&&data.subjects.length!==1||!data.canManage&&(data.subjects.length>0||data.requests.length>0)||data.requests.some(r=>r.subject_id!==workspaceId))throw new BusinessDirectoryError('BUSINESS_DIRECTORY_UNAVAILABLE');
   const pending=data.requests.filter(r=>r.status==='PENDING'&&!r.stale),types:BusinessDocumentType[]=['IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS'];
   return {id:workspaceId,workspaceId,name:data.name,handle:data.handle,managerName:data.managerName,canManage:data.canManage,documents:data.documents,
    subjects:data.canManage?[{id:workspaceId,kind:'BUSINESS_WORKSPACE',name:data.name,allowedTypes:types.filter(t=>!data.documents.some(b=>b.type===t&&b.verified)&&!pending.some(r=>r.verification_type===t)),pending:pending.length,badges:data.documents,vehicles:[]}]:[],
    requests:data.requests.map(r=>({id:r.id,subjectId:r.subject_id,subjectKind:r.subject_type,name:r.document_name,type:r.verification_type,status:r.status,submittedAt:r.submitted_at,reviewedAt:r.reviewed_at,expiresOn:r.expires_on,note:r.review_note||'',stale:r.stale,hasFile:r.has_file}))};
  }
 };
}
