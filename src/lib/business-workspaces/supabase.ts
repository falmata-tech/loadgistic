import {z} from 'zod';
import {createSupabaseAdminClient} from '../supabase-adapter.js';
import {BusinessWorkspaceError} from './domain.js';
import type {BusinessWorkspacePort} from './contracts';

export interface BusinessRpcPort {rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:{message:string}|null}>}
const id=z.string().uuid(),kind=z.enum(['BROKER','SHIPPER','RECEIVER']),role=z.enum(['OWNER','ADMIN','STAFF']);
const summary=z.object({id,name:z.string(),handle:z.string(),kind,city:z.string().nullable(),version:z.number().int().positive(),
 actorId:id,actorRole:z.literal('CUSTOMER'),membershipRole:role,membershipRevision:z.number().int().positive(),
 permissions:z.object({capacity:z.boolean(),tracking:z.boolean(),team:z.boolean(),owner:z.boolean()}).strict()}).strict();
const incoming=z.object({id,workspaceId:id,businessName:z.string(),handle:z.string(),role:z.enum(['ADMIN','STAFF']),capacity:z.boolean(),tracking:z.boolean(),expiresAt:z.string()}).strict();
const context=z.object({actorId:id,selectedWorkspaceId:id.nullable(),workspaces:z.array(summary),invitations:z.array(incoming)}).strict();
const member=z.object({userId:id,firstName:z.string(),role,active:z.boolean(),revision:z.number().int().positive(),capacity:z.boolean(),tracking:z.boolean(),email:z.string().optional(),erased:z.literal(true).optional()}).strict().refine(value=>!value.erased||!value.active&&!('email'in value));
const pending=z.object({id,email:z.string(),role:z.enum(['ADMIN','STAFF']),capacity:z.boolean(),tracking:z.boolean(),status:z.enum(['PENDING','EXPIRED']),expiresAt:z.string(),emailSentAt:z.string().nullable()}).strict();
const directory=z.object({workspace:summary,members:z.array(member),invitations:z.array(pending)}).strict();
const publicIdentity=z.object({id,name:z.string(),handle:z.string(),kind,city:z.string().nullable()}).strict();
const commandResult=z.object({workspaceId:id,version:z.number().int().positive(),action:z.enum(['UPDATE_DETAILS','INVITE','UPDATE_MEMBER','REMOVE_MEMBER','REVOKE_INVITATION','TRANSFER_OWNERSHIP','LEAVE','ARCHIVE']),invitationId:id.optional()}).strict();
const emailLease=z.object({id,workspaceId:id,email:z.string().email(),businessName:z.string(),expiresAt:z.string(),lease:id}).strict();
const codes=['ACCOUNT_HANDLE_UNAVAILABLE','INVALID_ACCOUNT_HANDLE','BUSINESS_IDENTITY_REQUIRED','BUSINESS_FORBIDDEN','INVALID_BUSINESS_INPUT','BUSINESS_REVISION_CONFLICT','BUSINESS_HANDLE_UNAVAILABLE',
 'BUSINESS_LIMIT_REACHED','BUSINESS_ALREADY_MEMBER','BUSINESS_INVITATION_EXISTS','BUSINESS_INVITATION_UNAVAILABLE','BUSINESS_MEMBER_NOT_FOUND','BUSINESS_OWNER_HANDOVER_REQUIRED'];

export function supabaseBusinessWorkspacePort(client:BusinessRpcPort=createSupabaseAdminClient()):BusinessWorkspacePort {
 async function rpc<T>(name:string,args:Record<string,unknown>,schema:z.ZodType<T>):Promise<T>{
  const {data,error}=await client.rpc(name,args);
  if(error)throw new BusinessWorkspaceError(codes.find(code=>error.message.includes(code))||'BUSINESS_UNAVAILABLE');
  const result=schema.safeParse(data);
  if(!result.success)throw new BusinessWorkspaceError('BUSINESS_UNAVAILABLE');
  return result.data;
 }
 async function actorSummary(name:string,actorId:string,args:Record<string,unknown>){
  const result=await rpc(name,{actor_user_id:actorId,...args},summary);
  if(result.actorId!==actorId)throw new BusinessWorkspaceError('BUSINESS_UNAVAILABLE');
  return result;
 }
 return {
  async context(actorId){
   const result=await rpc('business_workspace_context',{actor_user_id:actorId},context);
   if(result.actorId!==actorId||result.workspaces.some(item=>item.actorId!==actorId)||result.selectedWorkspaceId&&!result.workspaces.some(item=>item.id===result.selectedWorkspaceId))throw new BusinessWorkspaceError('BUSINESS_UNAVAILABLE');
   return result;
  },
  create:(actorId,input)=>actorSummary('business_workspace_create',actorId,{command:input}),
  async select(actorId,workspaceId){
   if(workspaceId===null){const result=await rpc('business_workspace_select',{actor_user_id:actorId,target_workspace_id:null},z.null());return result;}
   const result=await actorSummary('business_workspace_select',actorId,{target_workspace_id:workspaceId});if(result.id!==workspaceId)throw new BusinessWorkspaceError('BUSINESS_UNAVAILABLE');return result;
  },
  async directory(actorId,workspaceId){
   const result=await rpc('business_workspace_directory',{actor_user_id:actorId,target_workspace_id:workspaceId},directory);
   if(result.workspace.actorId!==actorId||result.workspace.id!==workspaceId||!result.workspace.permissions.team&&(result.invitations.length>0||result.members.some(item=>'email'in item)))throw new BusinessWorkspaceError('BUSINESS_UNAVAILABLE');
   return result;
  },
  async command(actorId,workspaceId,input){const result=await rpc('business_workspace_command',{actor_user_id:actorId,target_workspace_id:workspaceId,command:input},commandResult);if(result.workspaceId!==workspaceId||result.action!==input.action)throw new BusinessWorkspaceError('BUSINESS_UNAVAILABLE');return result;},
  accept:(actorId,invitationId)=>actorSummary('business_workspace_accept_invitation',actorId,{invitation_id:invitationId}),
  search:(actorId,query)=>rpc('business_workspace_search',{actor_user_id:actorId,search_text:query,requested_limit:10},z.array(publicIdentity)),
  async claimInvitationEmail(actorId,workspaceId,invitationId){
   const result=await rpc('business_workspace_claim_invitation_email',{actor_user_id:actorId,target_workspace_id:workspaceId,invitation_id:invitationId},emailLease.nullable());
   if(result&&(result.id!==invitationId||result.workspaceId!==workspaceId))throw new BusinessWorkspaceError('BUSINESS_UNAVAILABLE');return result;
  },
  recordInvitationEmail:(actorId,workspaceId,invitationId,leaseId,sent)=>rpc('business_workspace_record_invitation_email',{
   actor_user_id:actorId,target_workspace_id:workspaceId,invitation_id:invitationId,lease_id:leaseId,sent
  },z.boolean())
 };
}
