import 'server-only';
import {createSupabaseAdminClient} from './supabase-adapter.js';
import {chatReadInput,chatReadState,chatAlertSnapshot,chatConversationId} from './chat-read-policy.js';
import type {ChatReadAuthority,ChatReadState,ChatAlertSnapshot} from './chat-alert-contract';
const failure=(code:string|undefined)=>new Error(['FORBIDDEN','INVALID_CHAT_READ','CHAT_ASSIGNMENT_CHANGED'].includes(code||'')?code:'CHAT_READ_UNAVAILABLE');
export async function readChatReceipts(authority:ChatReadAuthority):Promise<ChatReadState>{
 const {data,error}=await createSupabaseAdminClient().rpc('chat_read_state',{chat_kind:authority.kind,target_id:chatConversationId(authority.id),actor_user_id:authority.actorId,access_digest:authority.digest||null});
 if(error)throw failure(error.message);return chatReadState(data);
}
export async function acknowledgeChatRead(authority:ChatReadAuthority,input:unknown):Promise<ChatReadState>{
 const {throughSequence,assignmentVersion}=chatReadInput(input);
 const {data,error}=await createSupabaseAdminClient().rpc('acknowledge_visible_chat_read',{chat_kind:authority.kind,target_id:chatConversationId(authority.id),actor_user_id:authority.actorId,access_digest:authority.digest||null,through_sequence:throughSequence,expected_assignment_version:assignmentVersion});
 if(error)throw failure(error.message);return chatReadState(data);
}
export async function readChatAlerts(actorId:string|null,visitor?:{requestId:string;digest:string|null}):Promise<ChatAlertSnapshot>{
 const {data,error}=await createSupabaseAdminClient().rpc('chat_alert_snapshot',{actor_user_id:actorId,visitor_request_id:visitor?.requestId||null,access_digest:visitor?.digest||null});
 if(error)throw failure(error.message);return chatAlertSnapshot(data);
}
