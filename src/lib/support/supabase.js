import {normalizeOptionalCallbackPhone,normalizePrivateContactEmail} from '../domain.js';
import {removePrivateUpload,readPrivateUpload,storePrivateUpload} from '../private-storage.js';
import {guestSupportAccessCode,privateContactDigest,verifyPrivateAccessCode} from '../security.js';
import {createSupabaseAdminClient} from '../supabase-adapter.js';

const ERRORS=['FORBIDDEN','NOT_FOUND','INVALID_SUPPORT_CATEGORY','INVALID_SUPPORT_MESSAGE','SUPPORT_CONVERSATION_ALREADY_OPEN',
  'SUPPORT_MESSAGE_RATE_LIMITED','SUPPORT_CONVERSATION_CLOSED','SUPPORT_AGENT_UNAVAILABLE','SUPPORT_AGENT_AT_CAPACITY',
  'SUPPORT_CONVERSATION_NOT_WAITING','INVALID_SUPPORT_VIEW','CALLBACK_PHONE_REQUIRED','GUEST_CONVERSATION_ALREADY_OPEN',
  'GUEST_SUPPORT_ACCESS_DENIED','INVALID_SUPPORT_AGENT_LIMIT','MISSING_REQUIRED_FIELDS','EMAIL_ALREADY_EXISTS',
  'MANAGED_IDENTITY_NOT_FOUND','INVALID_PRIVATE_STORAGE_REFERENCE'];

function managedError(fallback,error){
  const message=String(error?.message||'');
  return new Error(ERRORS.find(code=>message.includes(code))||fallback,{cause:error});
}

function bounds(options={},defaultSize=12){
  const pageSize=Math.max(1,Math.min(50,Number(options.pageSize)||defaultSize));
  const page=Math.max(1,Number(options.page)||1);
  return {page,pageSize,offset:(page-1)*pageSize};
}

function pageFromRows(rows,options={},defaultSize=12){
  const {page,pageSize}=bounds(options,defaultSize);
  const items=(rows||[]).map(row=>row?.payload||row);
  const total=Number(rows?.[0]?.total_count||0);
  return {items,total,page,pageSize,pageCount:Math.max(1,Math.ceil(total/pageSize))};
}

function pageFromJson(data,options={},defaultSize=15){
  const {page,pageSize}=bounds(options,defaultSize);const total=Number(data?.total||0);
  return {...data,items:data?.items||[],total,page,pageSize,pageCount:Math.max(1,Math.ceil(total/pageSize))};
}

function uploadCommand(stored){
  return stored?{storage_path:stored.path,original_name:stored.originalName,mime_type:stored.mimeType,size_bytes:stored.size}:{};
}

export async function createSupportConversation(user,input){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('create_managed_support_conversation',{actor_user_id:user.id,command:{category:String(input.category||''),body:String(input.body||'')}});
  if(error)throw managedError('SUPABASE_SUPPORT_CREATE_FAILED',error);return data;
}

export async function listMemberSupportConversations(user,options={}){
  const paging=bounds(options,10);const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('managed_member_support_page',{actor_user_id:user.id,requested_offset:paging.offset,requested_limit:paging.pageSize});
  if(error)throw managedError('SUPABASE_SUPPORT_HISTORY_FAILED',error);return pageFromRows(data,options,10);
}

export async function getOpenMemberSupportConversation(user){
  const client=createSupabaseAdminClient();const {data,error}=await client.rpc('managed_open_member_support',{actor_user_id:user.id});
  if(error)throw managedError('SUPABASE_SUPPORT_OPEN_FAILED',error);return data||null;
}

export async function getSupportConversation(user,conversationId,options={}){
  const client=createSupabaseAdminClient();const {data,error}=await client.rpc('managed_support_conversation',{
    actor_user_id:user.id,conversation_id:conversationId,requested_limit:Math.max(1,Math.min(50,Number(options.messageLimit)||50)),mark_read:options.markRead!==false
  });
  if(error)throw managedError('SUPABASE_SUPPORT_CONVERSATION_FAILED',error);return data;
}

export async function listSupportInbox(user,view='ASSIGNED',options={}){
  const paging=bounds(options,15);const client=createSupabaseAdminClient();const {data,error}=await client.rpc('managed_support_inbox',{
    actor_user_id:user.id,requested_view:String(view||'ASSIGNED'),requested_offset:paging.offset,requested_limit:paging.pageSize
  });
  if(error)throw managedError('SUPABASE_SUPPORT_INBOX_FAILED',error);return pageFromJson(data,options,15);
}

export async function sendSupportMessage(user,conversationId,body){
  const client=createSupabaseAdminClient();const {error}=await client.rpc('send_managed_support_message',{actor_user_id:user.id,conversation_id:conversationId,message_body:String(body||'')});
  if(error)throw managedError('SUPABASE_SUPPORT_MESSAGE_FAILED',error);
}

export async function claimSupportConversation(user,conversationId){
  const client=createSupabaseAdminClient();const {error}=await client.rpc('claim_managed_support_conversation',{actor_user_id:user.id,conversation_id:conversationId});
  if(error)throw managedError('SUPABASE_SUPPORT_CLAIM_FAILED',error);
}

export async function closeSupportConversation(user,conversationId){
  const client=createSupabaseAdminClient();const {error}=await client.rpc('close_managed_support_conversation',{actor_user_id:user.id,conversation_id:conversationId});
  if(error)throw managedError('SUPABASE_SUPPORT_CLOSE_FAILED',error);
}

export async function updateSupportAvailability(user,available){
  const client=createSupabaseAdminClient();const {error}=await client.rpc('update_managed_support_availability',{actor_user_id:user.id,requested_available:Boolean(available)});
  if(error)throw managedError('SUPABASE_SUPPORT_AVAILABILITY_FAILED',error);
}

export async function getAssistedMatchingAvailability(){
  const client=createSupabaseAdminClient();const {data,error}=await client.rpc('managed_assisted_matching_availability');
  if(error)throw managedError('SUPABASE_ASSISTED_AVAILABILITY_FAILED',error);return data||{available:false,availableTeamMembers:0};
}

export async function createGuestSupportConversation(input,file=/** @type {File|null} */(null)){
  const email=normalizePrivateContactEmail(input.email);const emailDigest=privateContactDigest(email);
  const phone=normalizeOptionalCallbackPhone(input.phone);if(!phone)throw new Error('CALLBACK_PHONE_REQUIRED');
  const stored=file&&typeof file.arrayBuffer==='function'&&file.size?await storePrivateUpload(file,'guest-support'):null;
  const client=createSupabaseAdminClient();const {data,error}=await client.rpc('create_managed_guest_support',{command:{
    email,email_digest:emailDigest,phone,body:String(input.body||''),...uploadCommand(stored)
  }});
  if(error){if(stored)await removePrivateUpload(stored.path).catch(()=>undefined);throw managedError('SUPABASE_GUEST_SUPPORT_CREATE_FAILED',error);}
  return {id:data.id,emailDigest,accessCode:guestSupportAccessCode(data.id)};
}

export async function verifyGuestSupportAccess(email,code){
  const normalized=normalizePrivateContactEmail(email);const emailDigest=privateContactDigest(normalized);const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('managed_guest_support_access_candidates',{requested_email_digest:emailDigest});
  if(error)throw managedError('SUPABASE_GUEST_SUPPORT_ACCESS_FAILED',error);
  const conversation=(data||[]).find(item=>verifyPrivateAccessCode(guestSupportAccessCode(item.conversation_id),code));
  if(!conversation)throw new Error('GUEST_SUPPORT_ACCESS_DENIED');return {conversationId:conversation.conversation_id,emailDigest};
}

async function getGuestConversation(actor,conversationId,emailDigest,options={}){
  const client=createSupabaseAdminClient();const {data,error}=await client.rpc('managed_guest_support_conversation',{
    actor_user_id:actor?.id||null,conversation_id:conversationId,requested_email_digest:emailDigest||null,
    requested_limit:Math.max(1,Math.min(50,Number(options.messageLimit)||50)),mark_read:options.markRead!==false
  });
  if(error)throw managedError('SUPABASE_GUEST_SUPPORT_CONVERSATION_FAILED',error);return data;
}

export function getGuestSupportConversationForGuest(conversationId,emailDigest,options={}){return getGuestConversation(null,conversationId,emailDigest,options);}
export function getGuestSupportConversationForTeam(user,conversationId,options={}){return getGuestConversation(user,conversationId,null,options);}

export async function listGuestSupportInbox(user,view='ASSIGNED',options={}){
  const paging=bounds(options,15);const client=createSupabaseAdminClient();const {data,error}=await client.rpc('managed_guest_support_inbox',{
    actor_user_id:user.id,requested_view:String(view||'ASSIGNED'),requested_offset:paging.offset,requested_limit:paging.pageSize
  });
  if(error)throw managedError('SUPABASE_GUEST_SUPPORT_INBOX_FAILED',error);return pageFromRows(data,options,15);
}

export async function claimGuestSupportConversation(user,conversationId){
  const client=createSupabaseAdminClient();const {error}=await client.rpc('claim_managed_guest_support',{actor_user_id:user.id,conversation_id:conversationId});
  if(error)throw managedError('SUPABASE_GUEST_SUPPORT_CLAIM_FAILED',error);
}

export async function sendGuestSupportMessage(actor,conversationId,body,emailDigest=/** @type {string|null} */(null),file=/** @type {File|null} */(null)){
  const stored=file&&typeof file.arrayBuffer==='function'&&file.size?await storePrivateUpload(file,'guest-support'):null;
  const client=createSupabaseAdminClient();const {error}=await client.rpc('send_managed_guest_support_message',{
    actor_user_id:actor?.id||null,conversation_id:conversationId,requested_email_digest:emailDigest||null,message_body:String(body||''),command:uploadCommand(stored)
  });
  if(error){if(stored)await removePrivateUpload(stored.path).catch(()=>undefined);throw managedError('SUPABASE_GUEST_SUPPORT_MESSAGE_FAILED',error);}
}

export async function closeGuestSupportConversation(user,conversationId){
  const client=createSupabaseAdminClient();const {error}=await client.rpc('close_managed_guest_support',{actor_user_id:user.id,conversation_id:conversationId,requested_email_digest:null});
  if(error)throw managedError('SUPABASE_GUEST_SUPPORT_CLOSE_FAILED',error);
}

export async function endGuestSupportConversation(conversationId,emailDigest){
  const client=createSupabaseAdminClient();const {error}=await client.rpc('close_managed_guest_support',{actor_user_id:null,conversation_id:conversationId,requested_email_digest:emailDigest});
  if(error)throw managedError('SUPABASE_GUEST_SUPPORT_CLOSE_FAILED',error);
}

export async function readGuestSupportAttachment(actor,conversationId,attachmentId,emailDigest=/** @type {string|null} */(null)){
  const client=createSupabaseAdminClient();const {data,error}=await client.rpc('managed_guest_support_attachment_file',{
    actor_user_id:actor?.id||null,conversation_id:conversationId,attachment_id:attachmentId,requested_email_digest:emailDigest||null
  });
  if(error||!data)throw managedError('NOT_FOUND',error);const bytes=await readPrivateUpload(data.storage_path);if(!bytes)throw new Error('NOT_FOUND');
  return {bytes,mimeType:data.mime_type,originalName:data.original_name};
}

export async function listSupportAgents(user,options={}){
  const paging=bounds(options,10);const client=createSupabaseAdminClient();const {data,error}=await client.rpc('managed_support_agent_page',{
    actor_user_id:user.id,requested_offset:paging.offset,requested_limit:paging.pageSize
  });
  if(error)throw managedError('SUPABASE_SUPPORT_AGENT_PAGE_FAILED',error);return pageFromRows(data,options,10);
}

function agentCommand(input){return {
  name:String(input.name||''),email:String(input.email||'').trim().toLowerCase(),max_open_conversations:Number(input.maxOpenConversations)||3,
  active:Boolean(input.active),available:Boolean(input.available),can_manage_customers:Boolean(input.canManageCustomers),
  can_manage_operations:Boolean(input.canManageOperations),can_manage_trust:Boolean(input.canManageTrust),
  can_manage_billing:Boolean(input.canManageBilling),can_manage_support:Boolean(input.canManageSupport??true)
};}

export async function createSupportAgent(user,input){
  const command=agentCommand({...input,active:true,available:true});if(!command.name||!command.email)throw new Error('MISSING_REQUIRED_FIELDS');
  const client=createSupabaseAdminClient();const {data:created,error:createError}=await client.auth.admin.createUser({
    email:command.email,email_confirm:true,user_metadata:{full_name:command.name},app_metadata:{role:'SUPPORT',provisioned_by:'loadgistic-admin'}
  });
  if(createError||!created.user)throw managedError('SUPABASE_SUPPORT_IDENTITY_CREATE_FAILED',createError);
  const {data,error}=await client.rpc('create_managed_support_agent',{actor_user_id:user.id,agent_auth_user_id:created.user.id,command});
  if(error){await client.auth.admin.deleteUser(created.user.id).catch(()=>undefined);throw managedError('SUPABASE_SUPPORT_AGENT_CREATE_FAILED',error);}return data;
}

export async function updateSupportAgent(user,agentUserId,input){
  const client=createSupabaseAdminClient();const {error}=await client.rpc('update_managed_support_agent',{actor_user_id:user.id,agent_user_id:agentUserId,command:agentCommand(input)});
  if(error)throw managedError('SUPABASE_SUPPORT_AGENT_UPDATE_FAILED',error);
}
