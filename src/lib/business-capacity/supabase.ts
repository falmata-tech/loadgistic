import {z} from 'zod';
import {createSupabaseAdminClient} from '../supabase-adapter.js';
import {listSupabaseBusinessCapacity} from '../repository/supabase.js';
import {BusinessWorkspaceError,businessId} from '../business-workspaces/domain.js';
import type {BusinessRpcPort} from '../business-workspaces/supabase';

export type BusinessCapacityPage={items:Record<string,unknown>[];hasMore:boolean;nextCursor:string|null;pageSize:number;filterError?:string|null};
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('GRANT'),vehicleId:z.string().uuid(),workspaceId:z.string().uuid()}).strict(),
 z.object({action:z.literal('REVOKE'),grantId:z.string().uuid(),revision:z.number().int().positive()}).strict()
]);
const granted=z.object({id:z.string().uuid(),vehicleId:z.string().uuid(),workspaceId:z.string().uuid(),revision:z.number().int().positive(),created:z.boolean()}).strict();
const revoked=z.object({id:z.string().uuid(),revision:z.number().int().positive(),revoked:z.literal(true)}).strict();
export function businessCapacitySharingPort(client:BusinessRpcPort=createSupabaseAdminClient()){
 return {async command(actorId:string,value:unknown){
  businessId(actorId);const parsed=input.safeParse(value);if(!parsed.success)throw new BusinessWorkspaceError('INVALID_BUSINESS_INPUT');
  const command=parsed.data;
  const result=await client.rpc(command.action==='GRANT'?'grant_business_capacity_access':'revoke_business_capacity_access',{
   actor_user_id:actorId,...(command.action==='GRANT'?{target_vehicle_id:command.vehicleId,target_workspace_id:command.workspaceId}:{target_grant_id:command.grantId,expected_revision:command.revision})
  });
  if(result.error){
   const code=['BUSINESS_FORBIDDEN','BUSINESS_REVISION_CONFLICT','EXCLUSIVE_RECIPIENT_ONLY'].find(code=>result.error?.message.includes(code));
   throw new BusinessWorkspaceError(code==='EXCLUSIVE_RECIPIENT_ONLY'?'INVALID_BUSINESS_INPUT':code||'BUSINESS_UNAVAILABLE');
  }
  if(command.action==='GRANT'){
   const saved=granted.safeParse(result.data);
   if(!saved.success||saved.data.vehicleId!==command.vehicleId||saved.data.workspaceId!==command.workspaceId)throw new BusinessWorkspaceError('BUSINESS_UNAVAILABLE');
   return saved.data;
  }
  const saved=revoked.safeParse(result.data);
  if(!saved.success||saved.data.id!==command.grantId)throw new BusinessWorkspaceError('BUSINESS_UNAVAILABLE');
  return saved.data;
 }};
}
export async function listBusinessCapacity(actorId:string,workspaceId:string,filters:Record<string,string>={}):Promise<BusinessCapacityPage>{
 businessId(actorId);businessId(workspaceId);
 try{return await listSupabaseBusinessCapacity(actorId,workspaceId,filters,{pageSize:100,cursor:filters.cursor});}
 catch(error){throw new BusinessWorkspaceError(error instanceof Error&&/INVALID_PRIVATE_PHOTO_FILTER/.test(error.message)?'INVALID_BUSINESS_INPUT':
  error instanceof Error&&/FORBIDDEN/.test(error.message)?'BUSINESS_FORBIDDEN':'BUSINESS_UNAVAILABLE');}
}

const searchItem=z.object({key:z.string(),kind:z.enum(['COMPANY','OWNER_OPERATOR','SELF_MANAGED_DRIVER']),title:z.string(),subtitle:z.string().nullable(),description:z.string().nullable(),identifier:z.string().nullable(),handle:z.string(),capacity_id:z.string().nullable(),city:z.string().nullable(),status:z.string().nullable(),owner:z.string(),driver:z.string().nullable(),account_name:z.string().nullable(),manager_name:z.string().nullable(),documents:z.array(z.unknown()),matching_trucks:z.number().int().positive()}).strict();
const searchResult=z.object({items:z.array(searchItem),total:z.number().int().nonnegative(),page:z.number().int().positive(),pageSize:z.literal(15),hasMore:z.boolean()}).strict();
export function businessCapacitySearchPort(client:BusinessRpcPort=createSupabaseAdminClient()){
 return {async search(actorId:string,workspaceId:string,text:string,page=1){
  businessId(actorId);businessId(workspaceId);
  if(typeof text!=='string'||text.trim().length>120||!Number.isSafeInteger(page)||page<1||page>10000)throw new BusinessWorkspaceError('INVALID_BUSINESS_INPUT');
  const {data,error}=await client.rpc('business_capacity_search',{actor_user_id:actorId,target_workspace_id:workspaceId,search_text:text.trim(),requested_page:page});
  if(error)throw new BusinessWorkspaceError(error.message.includes('BUSINESS_FORBIDDEN')?'BUSINESS_FORBIDDEN':'BUSINESS_UNAVAILABLE');
  const result=searchResult.safeParse(data);if(!result.success)throw new BusinessWorkspaceError('BUSINESS_UNAVAILABLE');
  return {...result.data,items:result.data.items.map(item=>({...item,accountName:item.account_name||item.owner,managerName:item.manager_name||'',kind:item.kind==='OWNER_OPERATOR'?'SELF_MANAGED_DRIVER' as const:item.kind}))};
 }};
}
