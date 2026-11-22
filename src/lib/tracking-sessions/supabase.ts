import {targetResult,incomingResult,acceptedResult,type RequestCommand} from './requests';
import {z} from 'zod';
import {createSupabaseAdminClient} from '../supabase-adapter.js';
import {trackingMapLocation} from '../tracking-map.js';
import {brokerReference,trackingSessionId,trackingSessionView,trackingSessionLink,trackingSessionCreate,trackingSessionIssueInput,trackingSessionListSchema,type TrackingSessionView} from './contracts';

export class TrackingSessionError extends Error {constructor(public code:string){super(code);}}
export interface TrackingSessionRpc {rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:{message:string}|null}>}
const rawRoute=z.array(z.object({placeRef:z.string(),label:z.string(),coordinate:z.tuple([z.number(),z.number()]).optional(),latitude:z.number().optional(),longitude:z.number().optional()})).min(2).max(3);
const projection=z.object({id:trackingSessionId,code:z.string(),operational_status:z.string(),updated_at:z.string(),tracking_mode:z.enum(['STATUS_ONLY','LOCATION_AND_STATUS']),
 can_view_location:z.boolean(),current_location:z.unknown().optional(),events:z.array(z.object({id:trackingSessionId,status:z.string(),note:z.string().nullable().optional(),created_at:z.string(),has_proof:z.boolean().optional()})).max(1000).default([]),review:z.object({rating:z.number().int().min(1).max(5),note:z.string(),createdAt:z.string().optional()}).nullable().optional()});
const base={reference:z.string(),state:z.enum(['PENDING_PROVIDER','CONNECTED','CANCELLED']),shipmentId:trackingSessionId.nullable(),route:rawRoute,cargoSummary:z.string(),pickupDate:z.string().nullable(),deliveryDate:z.string().nullable()};
const manager=z.object({...base,brokerReference:brokerReference.nullish(),requestExpired:z.boolean().optional(),id:trackingSessionId,revision:z.number().int().nonnegative(),workspaceId:trackingSessionId.nullable(),
 capabilities:z.object({canIssueLink:z.boolean(),canRevokeLink:z.boolean(),canAcceptProvider:z.boolean(),canApprove:z.boolean().optional(),canReadProof:z.boolean().optional(),canReview:z.boolean().optional(),canManageTeam:z.boolean().optional()}),links:z.array(trackingSessionLink).max(100),shipment:projection.nullable().optional()});
const guest=z.object({...base,id:trackingSessionId,sessionId:trackingSessionId,expiresAt:z.string(),shipment:projection.nullable()});
function result<T>(schema:z.ZodType<T>,value:unknown,code='TRACKING_UNAVAILABLE'):T{const parsed=schema.safeParse(value);if(!parsed.success)throw new TrackingSessionError(code);return parsed.data;}
function view(raw:z.infer<typeof manager>|z.infer<typeof guest>,isGuest=false):TrackingSessionView{
 const sessionId='sessionId'in raw?raw.sessionId:raw.id,shipment=raw.shipment;
 if((raw.state==='PENDING_PROVIDER'&&(raw.shipmentId!==null||shipment))||(raw.state==='CONNECTED'&&raw.shipmentId===null)||(shipment&&shipment.id!==raw.shipmentId))throw new TrackingSessionError('TRACKING_UNAVAILABLE');
 const point=shipment&&raw.state==='CONNECTED'?trackingMapLocation(shipment):null;
 return result(trackingSessionView,{
  id:sessionId,reference:raw.reference,...(!isGuest&&'brokerReference'in raw&&raw.brokerReference?{brokerReference:raw.brokerReference}:{}),...(!isGuest&&'requestExpired'in raw&&raw.requestExpired?{requestExpired:true}:{}),state:raw.state,revision:'revision'in raw?raw.revision:1,workspaceId:'workspaceId'in raw?raw.workspaceId:null,shipmentId:raw.shipmentId,
  route:raw.route.map(p=>({placeRef:p.placeRef,label:p.label,coordinate:p.coordinate??[p.longitude,p.latitude]})),cargoSummary:raw.cargoSummary,pickupDate:raw.pickupDate??'',deliveryDate:raw.deliveryDate??'',
  capabilities:!isGuest&&'capabilities'in raw?raw.capabilities:{canIssueLink:false,canRevokeLink:false,canAcceptProvider:false},links:!isGuest&&'links'in raw?raw.links:[],
  tracking:shipment?{shipmentId:shipment.id,code:shipment.code,status:shipment.operational_status,updatedAt:shipment.updated_at,trackingMode:shipment.can_view_location?shipment.tracking_mode:'STATUS_ONLY',
   location:point&&(point.source==='GPS'||point.source==='MOBILE')?{coordinate:[point.longitude,point.latitude],radiusKm:point.radius,label:point.area,updatedAt:point.updatedAt,source:point.source,...(point.demo===true?{demo:true}:{})}:null,
   events:shipment.events.map(e=>({id:e.id,status:e.status,note:e.note??'',createdAt:e.created_at,...(!isGuest&&'capabilities'in raw&&raw.capabilities.canReadProof?{hasProof:e.has_proof===true}:{})})),...(!isGuest?{review:shipment.review??null}:{})}:null
 });
}

export function trackingSessionService(client:TrackingSessionRpc=createSupabaseAdminClient()){
 async function rpc(name:string,args:Record<string,unknown>){
  const {data,error}=await client.rpc(name,args);
  if(error){const code=['TRACKING_ACCESS_DENIED','TRACKING_SESSION_FORBIDDEN','TRACKING_SESSION_NOT_FOUND','TRACKING_SESSION_CHANGED','TRACKING_SESSION_ALREADY_CONNECTED','TRACKING_SESSION_CONNECTED','TRACKING_REGISTERED_OWNER_REQUIRED','TRACKING_SHARING_CHANGED','TRACKING_RECIPIENT_LIMIT','TRACKING_APPROVAL_FORBIDDEN','TRACKING_HANDOVER_PROOF_REQUIRED','TRACKING_NOT_READY_FOR_APPROVAL','BUSINESS_FORBIDDEN','REVIEW_WORKSPACE_ONLY','REVIEW_NOT_ALLOWED','REVIEW_ALREADY_SUBMITTED','INVALID_RATING','INVALID_TRACKING_INPUT','INVALID_TRACKING_MODE','INVALID_DELIVERY_DATE','INVALID_CARGO_SUMMARY','LOCALITY_REQUIRED','ROUTE_LOCATIONS_MUST_DIFFER','NOT_FOUND','FORBIDDEN','SUBSCRIPTION_ACCESS_REQUIRED','INVALID_VEHICLE','DRIVER_REQUIRED_FOR_SHIPMENT','TRACKING_ALREADY_EXISTS','POLICY_REQUIRED'].find(code=>error.message.includes(code));throw new TrackingSessionError(code??'TRACKING_UNAVAILABLE');}
  return data;
 }
 const actor=(value:string)=>result(trackingSessionId,value);
 async function managed(name:string,args:Record<string,unknown>,expectedId?:string){const parsed=result(manager,await rpc(name,args));if(expectedId&&parsed.id!==expectedId)throw new TrackingSessionError('TRACKING_UNAVAILABLE');return view(parsed);}
 return {
  create:(actorId:string,input:unknown)=>managed('create_tracking_session',{actor_user_id:actor(actorId),command:result(trackingSessionCreate,input,'INVALID_TRACKING_INPUT')}),
  detail:(actorId:string,id:string)=>managed('tracking_session_detail',{actor_user_id:actor(actorId),target_session_id:actor(id)},id),
  async list(actorId:string,workspaceId:string|null,page=1,reference?:string){
   if(!Number.isSafeInteger(page)||page<1||page>10000)throw new TrackingSessionError('INVALID_TRACKING_SESSION');
   const scope={actor_user_id:actor(actorId),target_workspace_id:workspaceId===null?null:actor(workspaceId),requested_page:page};
   const data=reference===undefined?await rpc('tracking_session_workspace',scope):
    await rpc('tracking_session_reference_search',{...scope,requested_reference:result(brokerReference,reference,'INVALID_TRACKING_INPUT')});
   const raw=result(z.object({workspaceId:trackingSessionId.nullable(),total:z.number().int().nonnegative(),page:z.number().int().positive(),pageCount:z.number().int().positive(),sessions:z.array(manager).max(50)}),data);
   // The personal RPC selects by captured owner. An owned shipment can also be shared with a workspace.
   const wrongScope=raw.sessions.some(session=>workspaceId===null
    ? session.shipmentId===null
    : session.workspaceId!==workspaceId);
   if(raw.workspaceId!==workspaceId||raw.page!==Math.min(page,raw.pageCount)||wrongScope)throw new TrackingSessionError('TRACKING_UNAVAILABLE');
   return result(trackingSessionListSchema,{...raw,sessions:raw.sessions.map(s=>view(s))});
  },
  async request(actorId:string,command:RequestCommand){
   const user=actor(actorId);
   if(command.action==='INBOX')return result(incomingResult,await rpc('incoming_tracking_requests',{actor:user}));
   if(command.action==='DECLINE')return result(z.literal(true),await rpc('decline_tracking_request',{actor_user_id:user,target_session_id:command.sessionId,requested_revision:command.revision}));
   if(command.action==='ACCEPT'){
    const record=await managed('accept_tracking_request',{actor_user_id:user,target_session_id:command.sessionId,requested_revision:command.revision,command:{trackingMode:command.trackingMode}},command.sessionId);
    return result(acceptedResult,{shipmentId:record.shipmentId});
   }
   const {sessionId,...fields}=command;
   return result(targetResult,await rpc('manage_tracking_request',{actor:user,session_id:sessionId,command:fields}));
  },
  async attachPartner(actorId:string,shipmentId:string,email:string,digest:string){
   return result(z.literal(true),await rpc('attach_tracking_partner',{actor_user_id:actor(actorId),target_shipment_id:actor(shipmentId),partner_email:email,recipient_digest:digest}));
  },
  fromShipment:(actorId:string,shipmentId:string,workspaceId:string|null)=>managed('link_tracking_shipment',{actor_user_id:actor(actorId),target_shipment_id:actor(shipmentId),target_workspace_id:workspaceId===null?null:actor(workspaceId)}),
  async issue(actorId:string,id:string,digests:{linkDigest:string;codeDigest:string},input:unknown){
   const command=result(trackingSessionIssueInput,input,'INVALID_TRACKING_INPUT'),raw=result(trackingSessionLink.extend({sessionId:trackingSessionId}),await rpc('issue_tracking_session_link',{actor_user_id:actor(actorId),target_session_id:actor(id),link_digest:digests.linkDigest,code_digest:digests.codeDigest,command:{expiresInDays:command.expiresInDays,allowLocation:command.allowLocation}}));
   if(raw.sessionId!==id||raw.revokedAt!==null||raw.allowLocation!==command.allowLocation)throw new TrackingSessionError('TRACKING_UNAVAILABLE');return raw;
  },
  revoke:(actorId:string,id:string,linkId:string)=>managed('revoke_tracking_session_link',{actor_user_id:actor(actorId),target_session_id:actor(id),target_link_id:actor(linkId)},id),
  approve:(actorId:string,id:string)=>managed('approve_tracking_session_handover',{actor_user_id:actor(actorId),target_session_id:actor(id)},id),
  review:(actorId:string,id:string,command:unknown)=>managed('review_tracking_session_provider',{actor_user_id:actor(actorId),target_session_id:actor(id),command:result(z.object({rating:z.number().int().min(1).max(5),note:z.string().trim().max(1000),termsAccepted:z.literal(true)}).strict(),command,'INVALID_TRACKING_INPUT')},id),
  async proof(actorId:string,id:string,eventId:string){
   return result(z.object({storage_path:z.string().startsWith('supabase://shipment-proof/').max(500),mime_type:z.enum(['image/jpeg','image/png','image/webp']),original_name:z.string().max(160)}).strict().nullable(),await rpc('tracking_session_proof_file',{actor_user_id:actor(actorId),target_session_id:actor(id),target_event_id:actor(eventId)}));
  },
  async guest(digests:{linkDigest:string;codeDigest:string},expectedId?:string){
   const data=await rpc('read_tracking_session_link',{link_digest:digests.linkDigest,code_digest:digests.codeDigest});
   if(data===null)throw new TrackingSessionError('TRACKING_ACCESS_DENIED');
   const parsed=result(guest,data);
   if(parsed.id!==parsed.sessionId||expectedId&&parsed.sessionId!==expectedId||!Number.isFinite(Date.parse(parsed.expiresAt))||Date.parse(parsed.expiresAt)<=Date.now())throw new TrackingSessionError('TRACKING_ACCESS_DENIED');
   return {session:view(parsed,true),expiresAt:parsed.expiresAt};
  }
 };
}
