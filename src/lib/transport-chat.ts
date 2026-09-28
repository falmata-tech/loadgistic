import 'server-only';
import {cookies} from 'next/headers';
import {createHash} from 'node:crypto';
import {createSessionToken,verifySessionToken} from './security.js';
import {createSupabaseAdminClient} from './supabase-adapter.js';
import {validateTransportMessage,validateTransportRequest} from './domain.js';
import type {TransportRequestInput} from './transport-requests';
import type {TransportChatSnapshot} from './transport-chat-contract';
export const TRANSPORT_CHAT_COOKIE='lg_transport_chat';
const duration=7*24*60*60;
export type TransportChatAuthority={requestId:string;digest:string|null;actorId:string|null};
export async function beginTransportChat(input:TransportRequestInput,secret:string){
 if(!/^[a-f0-9]{64}$/.test(secret))throw new Error('INVALID_TRANSPORT_REQUEST');
 const {requestId,...command}=validateTransportRequest(input),digest=createHash('sha256').update('transport-chat:'+secret).digest('hex');
 const {error}=await createSupabaseAdminClient().rpc('create_transport_chat_request',{request_id:requestId,command,access_digest:digest});
 if(error)throw new Error(error.message==='FORBIDDEN'?'FORBIDDEN':'TRANSPORT_REQUEST_UNAVAILABLE');
 (await cookies()).set(TRANSPORT_CHAT_COOKIE,createSessionToken(`transport-chat:${requestId}:${digest}`,duration),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:duration});
}
export async function getTransportChatAuthority():Promise<TransportChatAuthority|null>{
 const payload=verifySessionToken((await cookies()).get(TRANSPORT_CHAT_COOKIE)?.value);
 const match=String(payload?.sub||'').match(/^transport-chat:([0-9a-f-]{36}):([a-f0-9]{64})$/);
 return match?{requestId:match[1],digest:match[2],actorId:null}:null;
}
export async function clearTransportChat(){(await cookies()).set(TRANSPORT_CHAT_COOKIE,'',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0});}
function args(authority:TransportChatAuthority){return {request_id:authority.requestId,access_digest:authority.digest,actor_user_id:authority.actorId};}
export async function readTransportChat(authority:TransportChatAuthority,after=0,before:number|null=null):Promise<TransportChatSnapshot>{
 const {data,error}=await createSupabaseAdminClient().rpc('transport_chat_snapshot',{...args(authority),after_sequence:after,before_sequence:before});
 if(error)throw new Error(error.message==='FORBIDDEN'?'FORBIDDEN':'TRANSPORT_CHAT_UNAVAILABLE');return data as TransportChatSnapshot;
}
export async function sendTransportMessage(authority:TransportChatAuthority,input:unknown){
 const command=validateTransportMessage(input);
 const {error}=await createSupabaseAdminClient().rpc('send_transport_chat_message',{...args(authority),message_id:command.messageId,message_body:command.body});
 if(error)throw new Error(['FORBIDDEN','TRANSPORT_CHAT_CLOSED','TRANSPORT_CHAT_ENDED','INVALID_TRANSPORT_MESSAGE'].includes(error.message)?error.message:'TRANSPORT_CHAT_UNAVAILABLE');
}

export async function endTransportChat(authority:TransportChatAuthority){
 if(authority.actorId||!authority.digest)throw new Error('FORBIDDEN');
 const {error}=await createSupabaseAdminClient().rpc('end_transport_chat',{request_id:authority.requestId,access_digest:authority.digest});
 if(error)throw new Error(error.message==='FORBIDDEN'?'FORBIDDEN':'TRANSPORT_CHAT_UNAVAILABLE');
}
