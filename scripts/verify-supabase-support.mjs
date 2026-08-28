import crypto from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const url=String(process.env.SUPABASE_SEED_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').trim();
const serviceRoleKey=String(process.env.SUPABASE_SEED_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
const anonKey=String(process.env.SUPABASE_SEED_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'').trim();
if(!url||!serviceRoleKey||!anonKey)throw new Error('SUPABASE_SUPPORT_VERIFY_CONFIG_MISSING');
if(!new Set(['127.0.0.1','localhost','::1']).has(new URL(url).hostname))throw new Error('REMOTE_SUPPORT_VERIFY_REFUSED');
const service=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
const anon=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false}});

async function createIdentity(email){
  const {data,error}=await service.auth.admin.createUser({email,password:crypto.randomBytes(24).toString('base64url'),email_confirm:true});
  if(error||!data.user)throw new Error('SUPPORT_VERIFY_IDENTITY_CREATE_FAILED');return data.user.id;
}

async function expectRpcDenied(name,args){
  const {error}=await anon.rpc(name,args);if(!error)throw new Error(`SUPPORT_ANONYMOUS_RPC_ALLOWED:${name}`);
}

const suffix=crypto.randomUUID().slice(0,12);const memberEmail=`support-member-${suffix}@loadgistic.local`;
const agentEmail=`support-agent-${suffix}@loadgistic.local`;const guestEmail=`support-guest-${suffix}@loadgistic.local`;
let memberId;let agentId;let memberConversationId;let guestConversationId;
try{
  const {data:admin,error:adminError}=await service.from('profiles').select('id').eq('role','ADMIN').eq('active',true).limit(1).maybeSingle();
  if(adminError||!admin)throw new Error('SUPPORT_VERIFY_ADMIN_MISSING');
  memberId=await createIdentity(memberEmail);agentId=await createIdentity(agentEmail);
  const {error:memberProfileError}=await service.from('profiles').upsert({id:memberId,email:memberEmail,full_name:'Support Test Member',role:'DRIVER',active:true},{onConflict:'id'});
  if(memberProfileError)throw new Error('SUPPORT_VERIFY_MEMBER_PROFILE_FAILED');
  const {error:agentCreateError}=await service.rpc('create_managed_support_agent',{actor_user_id:admin.id,agent_auth_user_id:agentId,command:{
    name:'Support Test Agent',email:agentEmail,max_open_conversations:3,can_manage_support:true
  }});
  if(agentCreateError)throw new Error(`SUPPORT_VERIFY_AGENT_CREATE_FAILED:${agentCreateError.message}`);

  const {data:memberCreated,error:memberCreateError}=await service.rpc('create_managed_support_conversation',{actor_user_id:memberId,command:{category:'CAPACITY',body:'Please help me understand my capacity settings.'}});
  if(memberCreateError||!memberCreated)throw new Error(`SUPPORT_VERIFY_MEMBER_CREATE_FAILED:${memberCreateError?.message||'EMPTY'}`);
  memberConversationId=memberCreated;
  const {data:memberOpen,error:memberOpenError}=await service.rpc('managed_open_member_support',{actor_user_id:memberId});
  if(memberOpenError||memberOpen?.id!==memberConversationId||!memberOpen.assigned_agent_user_id)throw new Error('SUPPORT_VERIFY_MEMBER_OPEN_INVALID');
  const assignedAgentId=memberOpen.assigned_agent_user_id;
  const {data:agentConversation,error:agentConversationError}=await service.rpc('managed_support_conversation',{
    actor_user_id:assignedAgentId,conversation_id:memberConversationId,requested_limit:50,mark_read:true
  });
  if(agentConversationError||agentConversation?.messages?.length!==1||JSON.stringify(agentConversation).includes(memberEmail))throw new Error(
    `SUPPORT_VERIFY_MEMBER_PROJECTION_INVALID:${agentConversationError?String(agentConversationError.message).slice(0,160):'RPC_OK'}:${Array.isArray(agentConversation?.messages)?agentConversation.messages.length:'NO_MESSAGES'}:${JSON.stringify(agentConversation).includes(memberEmail)?'EMAIL_EXPOSED':'EMAIL_HIDDEN'}`
  );
  const {error:memberMessageError}=await service.rpc('send_managed_support_message',{actor_user_id:assignedAgentId,conversation_id:memberConversationId,message_body:'Your settings are available from Capacity management.'});
  if(memberMessageError)throw new Error('SUPPORT_VERIFY_MEMBER_REPLY_FAILED');
  const {data:inbox,error:inboxError}=await service.rpc('managed_support_inbox',{actor_user_id:assignedAgentId,requested_view:'ASSIGNED',requested_offset:0,requested_limit:5});
  if(inboxError||!inbox?.items?.some(item=>item.id===memberConversationId)||inbox.items.length>5)throw new Error('SUPPORT_VERIFY_BOUNDED_INBOX_INVALID');
  const {error:memberCloseError}=await service.rpc('close_managed_support_conversation',{actor_user_id:memberId,conversation_id:memberConversationId});
  if(memberCloseError)throw new Error('SUPPORT_VERIFY_MEMBER_CLOSE_FAILED');
  const {error:closedMessageError}=await service.rpc('send_managed_support_message',{actor_user_id:memberId,conversation_id:memberConversationId,message_body:'This must fail.'});
  if(!closedMessageError||!closedMessageError.message.includes('SUPPORT_CONVERSATION_CLOSED'))throw new Error('SUPPORT_VERIFY_TERMINAL_MEMBER_CHAT_FAILED');

  const guestDigest=crypto.createHash('sha256').update(`guest:${suffix}`).digest('hex');
  const fakeReference=`supabase://support-attachment/guest-support/${new Date().toISOString().slice(0,10)}/${suffix}.pdf`;
  const {data:guestCreated,error:guestCreateError}=await service.rpc('create_managed_guest_support',{command:{
    email:guestEmail,email_digest:guestDigest,phone:'+251911000000',body:'I need help finding a suitable truck.',
    storage_path:fakeReference,original_name:'request.pdf',mime_type:'application/pdf',size_bytes:32
  }});
  if(guestCreateError||!guestCreated?.id)throw new Error(`SUPPORT_VERIFY_GUEST_CREATE_FAILED:${guestCreateError?.message||'EMPTY'}`);
  guestConversationId=guestCreated.id;
  const {data:guestProjection,error:guestProjectionError}=await service.rpc('managed_guest_support_conversation',{
    actor_user_id:null,conversation_id:guestConversationId,requested_email_digest:guestDigest,requested_limit:50,mark_read:true
  });
  if(guestProjectionError||guestProjection?.email!==null||guestProjection?.phone!==null||JSON.stringify(guestProjection).includes(fakeReference))throw new Error('SUPPORT_VERIFY_GUEST_PROJECTION_INVALID');
  const {data:guestRow,error:guestRowError}=await service.from('guest_support_conversations').select('assigned_agent_user_id').eq('id',guestConversationId).single();
  if(guestRowError||!guestRow.assigned_agent_user_id)throw new Error('SUPPORT_VERIFY_GUEST_ASSIGNMENT_MISSING');
  const {data:teamProjection,error:teamProjectionError}=await service.rpc('managed_guest_support_conversation',{
    actor_user_id:guestRow.assigned_agent_user_id,conversation_id:guestConversationId,requested_email_digest:null,requested_limit:50,mark_read:true
  });
  if(teamProjectionError||teamProjection?.email!==guestEmail||teamProjection?.phone!=='+251911000000')throw new Error('SUPPORT_VERIFY_TEAM_CONTACT_PROJECTION_INVALID');
  const {data:attachment,error:attachmentLookupError}=await service.from('guest_support_attachments').select('id').eq('conversation_id',guestConversationId).single();
  if(attachmentLookupError||!attachment)throw new Error('SUPPORT_VERIFY_ATTACHMENT_MISSING');
  const {data:file,error:fileError}=await service.rpc('managed_guest_support_attachment_file',{
    actor_user_id:null,conversation_id:guestConversationId,attachment_id:attachment.id,requested_email_digest:guestDigest
  });
  if(fileError||file?.storage_path!==fakeReference)throw new Error('SUPPORT_VERIFY_ATTACHMENT_AUTH_FAILED');
  const {error:guestCloseError}=await service.rpc('close_managed_guest_support',{actor_user_id:null,conversation_id:guestConversationId,requested_email_digest:guestDigest});
  if(guestCloseError)throw new Error('SUPPORT_VERIFY_GUEST_CLOSE_FAILED');

  const {data:agents,error:agentsError}=await service.rpc('managed_support_agent_page',{actor_user_id:admin.id,requested_offset:0,requested_limit:5});
  if(agentsError||agents.length>5||JSON.stringify(agents).includes('password'))throw new Error('SUPPORT_VERIFY_AGENT_PAGE_INVALID');
  const {error:agentUpdateError}=await service.rpc('update_managed_support_agent',{actor_user_id:admin.id,agent_user_id:agentId,command:{
    active:false,available:false,max_open_conversations:3,can_manage_support:false
  }});
  if(agentUpdateError)throw new Error('SUPPORT_VERIFY_AGENT_UPDATE_FAILED');

  await expectRpcDenied('managed_support_conversation',{actor_user_id:memberId,conversation_id:memberConversationId,requested_limit:50,mark_read:false});
  await expectRpcDenied('managed_guest_support_conversation',{actor_user_id:null,conversation_id:guestConversationId,requested_email_digest:guestDigest,requested_limit:50,mark_read:false});
  await expectRpcDenied('managed_support_agent_page',{actor_user_id:admin.id,requested_offset:0,requested_limit:5});
  process.stdout.write('Supabase member Support, Assisted matching, private attachment authorization, bounded queues, atomic assignment, terminal closure, passwordless team provisioning, and browser denial checks passed.\n');
}finally{
  if(memberConversationId)await service.from('support_conversations').delete().eq('id',memberConversationId);
  if(guestConversationId){await service.from('access_email_deliveries').delete().eq('entity_id',guestConversationId);await service.from('guest_support_conversations').delete().eq('id',guestConversationId);}
  if(memberId)await service.from('audit_logs').delete().eq('actor_user_id',memberId);
  if(agentId)await service.from('audit_logs').delete().or(`actor_user_id.eq.${agentId},entity_id.eq.${agentId}`);
  if(memberId)await service.auth.admin.deleteUser(memberId);
  if(agentId)await service.auth.admin.deleteUser(agentId);
}
