import 'server-only';
import {createSupabaseAdminClient} from './supabase-adapter.js';
import {validateTransportRequest,validateTransportFollowUp} from './domain.js';

export type TransportRequestStatus='NEW'|'CONTACTED'|'CLOSED';
export type TransportRequestInput={requestId:string;name:string;phone:string;origin:string;destination:string};
export type TransportRequest={id:string;requester_name:string;phone:string;origin:string;destination:string;status:TransportRequestStatus;follow_up_note:string;version:number;created_at:string;updated_at:string};
export type TransportRequestInbox={items:TransportRequest[];total:number;page:number;pageCount:number;counts:Record<TransportRequestStatus|'ALL',number>};
function failure(error:{message:string}){
  const known=['FORBIDDEN','NOT_FOUND','INVALID_TRANSPORT_REQUEST','INVALID_TRANSPORT_FOLLOW_UP','TRANSPORT_REQUEST_CHANGED','INVALID_TRANSPORT_VIEW','INVALID_BROKERAGE_ASSIGNEE'];
  return new Error(known.includes(error.message)?error.message:'TRANSPORT_REQUEST_UNAVAILABLE');
}
export async function createTransportRequest(input:TransportRequestInput){
  const {requestId,...command}=validateTransportRequest(input);
  const {error}=await createSupabaseAdminClient().rpc('create_transport_service_request',{request_id:requestId,command});
  if(error)throw failure(error);
}
export async function listTransportRequests(actor:{id:string},view:string,page:unknown):Promise<TransportRequestInbox>{
  const requestedPage=Math.max(1,Math.min(1000000,Math.floor(Number(page)||1)));
  const {data,error}=await createSupabaseAdminClient().rpc('transport_service_request_inbox',{actor_user_id:actor.id,requested_view:view,requested_page:requestedPage});
  if(error)throw failure(error);return data as TransportRequestInbox;
}
export async function updateTransportRequest(actor:{id:string},id:string,input:{status:string;note:string;version:number}){
  const command=validateTransportFollowUp(input);
  const {error}=await createSupabaseAdminClient().rpc('update_transport_service_request',{actor_user_id:actor.id,request_id:id,expected_version:command.version,next_status:command.status,note:command.note});
  if(error)throw failure(error);
}

export type BrokerageRequest=Omit<TransportRequest,'requester_name'|'phone'|'follow_up_note'>&{
 requester_name:string|null;phone:string|null;follow_up_note:string|null;
 chat_enabled:boolean;chat_ended_at:string|null;chat_expires_at:string|null;awaiting_reply:boolean;last_message_sequence:number;
 assigned_agent_user_id:string|null;assigned_agent_name:string|null;
 activity:Array<{id:string;status:TransportRequestStatus;note:string;version:number;created_at:string;actor_name:string|null;assigned_agent_name:string|null}>;
};
export type BrokerageInbox=Omit<TransportRequestInbox,'items'|'counts'>&{counts:TransportRequestInbox['counts']&Record<'ACTIVE'|'FOLLOW_UP',number>;items:BrokerageRequest[];queues:Record<'MINE'|'UNASSIGNED'|'ALL',number>;agents:Array<{id:string;name:string}>};
export async function listBrokerageRequests(actor:{id:string},queue:string,view:string,page:unknown):Promise<BrokerageInbox>{
 const {data,error}=await createSupabaseAdminClient().rpc('brokerage_request_inbox',{actor_user_id:actor.id,requested_queue:queue,requested_view:view,requested_page:Math.max(1,Math.min(1000000,Math.floor(Number(page)||1)))});
 if(error)throw failure(error);return data as BrokerageInbox;
}
export async function assignTransportRequest(actor:{id:string},id:string,version:number,target:string|null,claim:boolean){
 if(!Number.isInteger(version)||version<1)throw new Error('INVALID_TRANSPORT_FOLLOW_UP');
 const {error}=await createSupabaseAdminClient().rpc('assign_transport_service_request',{actor_user_id:actor.id,request_id:id,expected_version:version,target_user_id:target,claim});
 if(error)throw failure(error);
}
