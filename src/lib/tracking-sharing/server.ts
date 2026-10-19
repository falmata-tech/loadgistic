import {createSupabaseAdminClient} from '../supabase-adapter.js';
import {providerTrackingRecipientDigest} from '../security.js';
import {businessTrackingListSchema,businessTrackingProjection,ownerSharingCommand,ownerSharingSchema,TrackingSharingError,type OwnerVerification} from './domain';

export interface TrackingSharingRpcPort{rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:{message:string}|null}>}
const codes=['TRACKING_SESSION_EXPIRED','TRACKING_APPROVAL_FORBIDDEN','TRACKING_SHARING_CHANGED','INVALID_TRACKING_RECIPIENTS','TRACKING_ACCESS_DENIED',
 'TRACKING_RECIPIENTS_CLOSED','TRACKING_RECIPIENT_EXISTS','TRACKING_RECIPIENT_LIMIT','BUSINESS_FORBIDDEN','NOT_FOUND'];
export function trackingSharingService(port:TrackingSharingRpcPort=createSupabaseAdminClient()){
 async function rpc(name:string,args:Record<string,unknown>){const {data,error}=await port.rpc(name,args);if(error)throw new TrackingSharingError(codes.find(code=>error.message.includes(code))||'TRACKING_UNAVAILABLE');return data;}
 const verification=(proof:OwnerVerification)=>({recipient_digest:proof.digest,verified_at:new Date(proof.startedAt).toISOString()});
 const sharing=(value:unknown,shipmentId:string)=>{const result=ownerSharingSchema.safeParse(value);if(!result.success||result.data.shipmentId!==shipmentId)throw new TrackingSharingError('TRACKING_UNAVAILABLE');return result.data;};
 return{
  async owner(shipmentId:string,proof:OwnerVerification){return sharing(await rpc('tracking_owner_sharing',{target_shipment_id:shipmentId,...verification(proof)}),shipmentId);},
  async command(shipmentId:string,proof:OwnerVerification,input:unknown){
   const parsed=ownerSharingCommand.safeParse(input);if(!parsed.success)throw new TrackingSharingError('INVALID_TRACKING_RECIPIENTS');
   const command=parsed.data.action==='ADD_VIEWER'?{...parsed.data,email:parsed.data.email.toLowerCase(),digest:providerTrackingRecipientDigest(parsed.data.email.toLowerCase())}:parsed.data;
   return sharing(await rpc('tracking_owner_sharing_command',{target_shipment_id:shipmentId,...verification(proof),command}),shipmentId);
  },
  async attach(actorId:string,workspaceId:string,shipmentId:string,proof:OwnerVerification,expectedRevision:number){
   return sharing(await rpc('tracking_owner_sharing_command',{actor_user_id:actorId,target_shipment_id:shipmentId,...verification(proof),
    command:{action:'ATTACH_BUSINESS',workspaceId,expectedRevision}}),shipmentId);
  },
  async list(actorId:string,workspaceId:string,page=1){const result=businessTrackingListSchema.safeParse(await rpc('business_tracking_workspace',{actor_user_id:actorId,target_workspace_id:workspaceId,requested_page:page}));
   if(!result.success||result.data.workspaceId!==workspaceId)throw new TrackingSharingError('TRACKING_UNAVAILABLE');return result.data;},
  async detail(actorId:string,workspaceId:string,shipmentId:string){return businessTrackingProjection(await rpc('business_tracking_detail',{actor_user_id:actorId,target_workspace_id:workspaceId,target_shipment_id:shipmentId}),workspaceId,shipmentId);},
 };
}
export const listBusinessTracking=(actorId:string,workspaceId:string,page=1)=>trackingSharingService().list(actorId,workspaceId,page);
export const getBusinessTrackingDetail=(actorId:string,workspaceId:string,shipmentId:string)=>trackingSharingService().detail(actorId,workspaceId,shipmentId);
