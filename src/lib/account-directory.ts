import {z} from 'zod';
import {createSupabaseAdminClient} from './supabase-adapter.js';
import {directoryIdentity,directorySearch} from './business-directory/domain.js';

export class AccountDirectoryError extends Error {constructor(public code:string){super(code);}}
export const accountKind=z.enum(['ORGANIZATION','PROVIDER_PROFILE','BUSINESS','DRIVER']);
const baseAccount=z.object({kind:accountKind,id:z.string().uuid(),name:z.string().min(1).max(140),handle:z.string().nullable(),managerName:z.string().nullable(),city:z.string().nullable()}).strict();
export const accountStatus=z.enum(['TRANSPORT_PROVIDER','FLEET_PROVIDER','OWNER_OPERATED','LICENSED_OPERATOR','SELF_MANAGED','ACCOUNT_MANAGED','FLEET_DRIVER']);
const account=baseAccount.extend({statusBadge:accountStatus.nullable(),networkSize:z.number().int().nonnegative().nullable(),connectionStatus:z.enum(['PENDING','ACCEPTED']).nullable(),connectionDirection:z.enum(['INCOMING','OUTGOING']).nullable()}).strict();
const connection=z.object({id:z.string().uuid(),status:z.enum(['PENDING','ACCEPTED','DECLINED','CANCELLED','REVOKED']),direction:z.enum(['INCOMING','OUTGOING']),canManage:z.boolean(),account:z.union([baseAccount,z.object({kind:z.literal('UNAVAILABLE'),id:z.null(),name:z.literal('Unavailable account'),handle:z.null(),managerName:z.null(),city:z.null()}).strict()]),createdAt:z.string(),updatedAt:z.string()}).strict();
const vehicleGrant=z.object({id:z.string().uuid(),vehicleId:z.string().uuid(),connectionId:z.string().uuid(),revision:z.number().int().positive(),created:z.boolean()}).strict();
const vehicleRevocation=z.object({id:z.string().uuid(),revision:z.number().int().positive(),revoked:z.literal(true)}).strict();
export type DirectoryAccount=z.infer<typeof account>;
export type AccountConnection=z.infer<typeof connection>;
export type AccountDirectoryPage={items:DirectoryAccount[];total:number;page:number;pageSize:number;pageCount:number};
type RpcClient={rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:{message:string}|null}>};
const dbErrors=['DIRECTORY_FORBIDDEN','DIRECTORY_INVALID_INPUT','DIRECTORY_INVALID_TARGET','DIRECTORY_NOT_FOUND','DIRECTORY_REVISION_CONFLICT','NETWORK_FORBIDDEN','NETWORK_INVALID_INPUT','NETWORK_REVISION_CONFLICT','EXCLUSIVE_RECIPIENT_ONLY'];
async function rpc(client:RpcClient,name:string,args:Record<string,unknown>){
 const {data,error}=await client.rpc(name,args);
 if(error)throw new AccountDirectoryError(dbErrors.find(code=>error.message.includes(code))||'DIRECTORY_UNAVAILABLE');
 return data;
}
export function accountDirectoryPort(client:RpcClient=createSupabaseAdminClient()){
 return {
  async search(actorId:string,q='',page=1):Promise<AccountDirectoryPage>{
   directoryIdentity(actorId);const input=directorySearch(q,String(page)),pageSize=8;
   const pageAccount=baseAccount.extend({connectionStatus:z.enum(['PENDING','ACCEPTED']).nullable(),connectionDirection:z.enum(['INCOMING','OUTGOING']).nullable()}).strict();
   const schema=z.array(z.object({payload:pageAccount,total_count:z.union([z.number().int().nonnegative(),z.string().regex(/^\d+$/)])}).strict()).max(pageSize);
   const load=async(offset:number)=>{const parsed=schema.safeParse(await rpc(client,'account_directory_page',{actor_user_id:actorId,search_text:input.query,requested_offset:offset,requested_limit:pageSize}));if(!parsed.success)throw new AccountDirectoryError('DIRECTORY_UNAVAILABLE');return parsed.data;};
   let actualPage=input.page,rows=await load((actualPage-1)*pageSize);
   if(actualPage>1&&!rows.length){actualPage=1;rows=await load(0);}
   const total=Number(rows[0]?.total_count||0);
   if(!Number.isSafeInteger(total)||rows.some(row=>Number(row.total_count)!==total))throw new AccountDirectoryError('DIRECTORY_UNAVAILABLE');
   const identities=rows.map(row=>row.payload);
   const statusRows=z.array(z.object({kind:accountKind,id:z.string().uuid(),status:accountStatus.nullable()}).strict()).max(pageSize).safeParse(
    identities.length?await rpc(client,'account_directory_statuses',{actor_user_id:actorId,account_kinds:identities.map(item=>item.kind),account_ids:identities.map(item=>item.id)}):[]);
   if(!statusRows.success||statusRows.data.length!==identities.length)throw new AccountDirectoryError('DIRECTORY_UNAVAILABLE');
   const networkRows=z.array(z.object({kind:accountKind,id:z.string().uuid(),network_size:z.union([z.number().int().nonnegative(),z.string().regex(/^\d+$/)]).nullable()}).strict()).max(pageSize).safeParse(
    identities.length?await rpc(client,'account_directory_network_sizes',{actor_user_id:actorId,account_kinds:identities.map(item=>item.kind),account_ids:identities.map(item=>item.id)}):[]);
   if(!networkRows.success||networkRows.data.length!==identities.length)throw new AccountDirectoryError('DIRECTORY_UNAVAILABLE');
   const items=identities.map((item,index)=>{
    const badge=statusRows.data[index],network=networkRows.data[index];
    if(badge.kind!==item.kind||badge.id!==item.id||network.kind!==item.kind||network.id!==item.id||item.kind!=='BUSINESS'&&network.network_size!==null)throw new AccountDirectoryError('DIRECTORY_UNAVAILABLE');
    const networkSize=network.network_size===null?null:Number(network.network_size);
    if(networkSize!==null&&!Number.isSafeInteger(networkSize))throw new AccountDirectoryError('DIRECTORY_UNAVAILABLE');
    return account.parse({...item,statusBadge:badge.status,networkSize});
   });
   return {items,total,page:actualPage,pageSize,pageCount:Math.max(1,Math.ceil(total/pageSize))};
  },
  async networkPreference(actorId:string,workspaceId:unknown){
   directoryIdentity(actorId);const id=z.string().uuid().safeParse(workspaceId);
   if(!id.success)throw new AccountDirectoryError('NETWORK_INVALID_INPUT');
   const value=z.object({visible:z.boolean(),version:z.number().int().positive()}).strict().safeParse(await rpc(client,'business_network_preference',{actor_user_id:actorId,target_workspace_id:id.data}));
   if(!value.success)throw new AccountDirectoryError('DIRECTORY_UNAVAILABLE');return value.data;
  },
  async setNetworkPreference(actorId:string,workspaceId:unknown,visible:unknown,expectedVersion:unknown){
   directoryIdentity(actorId);const id=z.string().uuid().safeParse(workspaceId),flag=z.boolean().safeParse(visible),version=z.number().int().positive().safeParse(expectedVersion);
   if(!id.success||!flag.success||!version.success)throw new AccountDirectoryError('NETWORK_INVALID_INPUT');
   const value=z.object({visible:z.boolean(),version:z.number().int().positive()}).strict().safeParse(await rpc(client,'set_business_network_visibility',{actor_user_id:actorId,target_workspace_id:id.data,visible:flag.data,expected_version:version.data}));
   if(!value.success||value.data.visible!==flag.data)throw new AccountDirectoryError('DIRECTORY_UNAVAILABLE');return value.data;
  },
  async connections(actorId:string):Promise<AccountConnection[]>{
   directoryIdentity(actorId);const parsed=z.array(z.object({payload:connection}).strict()).max(100).safeParse(await rpc(client,'account_connection_list',{actor_user_id:actorId}));
   if(!parsed.success)throw new AccountDirectoryError('DIRECTORY_UNAVAILABLE');return parsed.data.map(row=>row.payload);
  },
  async request(actorId:string,kind:unknown,id:unknown){
   directoryIdentity(actorId);const selectedKind=accountKind.safeParse(kind),selectedId=z.string().uuid().safeParse(id);
   if(!selectedKind.success||!selectedId.success)throw new AccountDirectoryError('DIRECTORY_INVALID_INPUT');
   const parsed=z.object({id:z.string().uuid(),status:z.literal('PENDING').or(z.literal('ACCEPTED')),created:z.boolean()}).strict().safeParse(await rpc(client,'request_account_connection',{actor_user_id:actorId,target_kind:selectedKind.data,target_id:selectedId.data}));
   if(!parsed.success)throw new AccountDirectoryError('DIRECTORY_UNAVAILABLE');return parsed.data;
  },
  async decide(actorId:string,id:unknown,decision:unknown){
   directoryIdentity(actorId);const selectedId=z.string().uuid().safeParse(id),selectedDecision=z.enum(['ACCEPT','DECLINE','CANCEL','REVOKE']).safeParse(decision);
   if(!selectedId.success||!selectedDecision.success)throw new AccountDirectoryError('DIRECTORY_INVALID_INPUT');
   const parsed=z.object({id:z.string().uuid(),status:z.enum(['ACCEPTED','DECLINED','CANCELLED','REVOKED'])}).strict().safeParse(await rpc(client,'decide_account_connection',{actor_user_id:actorId,target_connection_id:selectedId.data,decision:selectedDecision.data}));
   if(!parsed.success)throw new AccountDirectoryError('DIRECTORY_UNAVAILABLE');return parsed.data;
  },
  async grantVehicle(actorId:string,connectionId:unknown,vehicleId:unknown){
   directoryIdentity(actorId);const relation=z.string().uuid().safeParse(connectionId),vehicle=z.string().uuid().safeParse(vehicleId);
   if(!relation.success||!vehicle.success)throw new AccountDirectoryError('DIRECTORY_INVALID_INPUT');
   const parsed=vehicleGrant.safeParse(await rpc(client,'grant_account_capacity_access',{actor_user_id:actorId,target_connection_id:relation.data,target_vehicle_id:vehicle.data}));
   if(!parsed.success||parsed.data.connectionId!==relation.data||parsed.data.vehicleId!==vehicle.data)throw new AccountDirectoryError('DIRECTORY_UNAVAILABLE');
   return parsed.data;
  },
  async revokeVehicle(actorId:string,grantId:unknown,revision:unknown){
   directoryIdentity(actorId);const grant=z.string().uuid().safeParse(grantId),version=z.number().int().positive().safeParse(revision);
   if(!grant.success||!version.success)throw new AccountDirectoryError('DIRECTORY_INVALID_INPUT');
   const parsed=vehicleRevocation.safeParse(await rpc(client,'revoke_account_capacity_access',{actor_user_id:actorId,target_grant_id:grant.data,expected_revision:version.data}));
   if(!parsed.success||parsed.data.id!==grant.data)throw new AccountDirectoryError('DIRECTORY_UNAVAILABLE');
   return parsed.data;
  }
 };
}
