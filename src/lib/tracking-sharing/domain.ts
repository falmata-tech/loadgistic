import {z} from 'zod';
import {guestTrackingDetail,trackingSummary} from '../mobile/tracking-contract';

const id=z.string().uuid(),revision=z.number().int().min(0).max(2147483646);
export const ownerSharingCommand=z.discriminatedUnion('action',[
 z.object({action:z.literal('ADD_VIEWER'),expectedRevision:revision,name:z.string().trim().min(1).max(80).refine(value=>!/[\u0000-\u001f\u007f]/.test(value)),email:z.string().trim().email().max(254)}).strict(),
 z.object({action:z.literal('REVOKE_VIEWER'),expectedRevision:revision,recipientId:id}).strict(),
 z.object({action:z.literal('DETACH_BUSINESS'),expectedRevision:revision}).strict(),
 z.object({action:z.literal('ALLOW_LOCATION'),expectedRevision:revision,userId:id}).strict(),
 z.object({action:z.literal('REMOVE_LOCATION'),expectedRevision:revision,userId:id}).strict(),
]);
export const attachTrackingBusiness=z.object({expectedRevision:revision,ownerVerification:z.string().max(2048).optional()}).strict();
export const ownerSharingSchema=z.object({shipmentId:id,revision,canInvite:z.boolean(),
 viewers:z.array(z.object({id,name:z.string(),email:z.string(),revoked:z.boolean(),createdAt:z.string()}).strict()).max(20),
 business:z.object({id,name:z.string(),handle:z.string(),active:z.boolean()}).strict().nullable(),
 staff:z.array(z.object({userId:id,firstName:z.string(),locationAllowed:z.boolean()}).strict()).max(100),
}).strict();
export type OwnerSharing=z.infer<typeof ownerSharingSchema>;
export type OwnerSharingCommand=z.infer<typeof ownerSharingCommand>;
export type OwnerVerification={digest:string;startedAt:number};
const summary=z.object({id,code:z.string(),origin:z.string(),destination:z.string(),cargo:z.string(),status:z.string(),driver:z.string(),truck:z.string(),updatedAt:z.string()}).strict();
export const businessTrackingListSchema=z.object({workspaceId:id,total:z.number().int().min(0),page:z.number().int().positive(),pageCount:z.number().int().positive(),shipments:z.array(summary).max(20)}).strict();
export type BusinessTrackingList=z.infer<typeof businessTrackingListSchema>;
export class TrackingSharingError extends Error{constructor(public code:string){super(code);}}

/** Projection rejects authority contradictions, then emits only the established
 * public shipment fields. No hidden private payload is passed to the browser. */
export function businessTrackingProjection(value:unknown,workspaceId:string,shipmentId:string){
 const envelope=z.object({workspaceId:id,isOwner:z.boolean(),shipment:z.record(z.string(),z.unknown())}).strict().safeParse(value);
 if(!envelope.success||envelope.data.workspaceId!==workspaceId||envelope.data.shipment.id!==shipmentId)throw new TrackingSharingError('TRACKING_UNAVAILABLE');
 const source=envelope.data.shipment;
 if(source.recipient_role!==(envelope.data.isOwner?'BUSINESS_OWNER':'BUSINESS_STAFF')||typeof source.can_view_location!=='boolean'||source.can_approve!==false||source.can_share!==false||source.can_review!==false
  ||source.can_view_location===false&&source.current_location!==null)throw new TrackingSharingError('TRACKING_UNAVAILABLE');
 const normalized=guestTrackingDetail(source);
 if(!summary.safeParse(trackingSummary(source)).success||normalized.route.length<2||normalized.events.some(item=>item.hasProof))throw new TrackingSharingError('TRACKING_UNAVAILABLE');
 const location=normalized.location;
 const shipment={id:normalized.id,code:normalized.code,origin:normalized.origin,destination:normalized.destination,cargo_summary:normalized.cargo,
  operational_status:normalized.status,tracking_mode:normalized.mode,provider_name:normalized.provider,recipient_role:source.recipient_role,
  route:normalized.route,public_truck_summary:normalized.publicTruck,
  current_location:location?{location_lat:location.latitude,location_lng:location.longitude,location_area:location.area,location_precision_km:location.radius,
   updated_at:location.updatedAt,location_source:location.source||null,...(location.demo===true?{is_demo:true}: {})}:null,
  can_view_location:source.can_view_location,can_share:false,can_approve:false,can_review:false,review:null,
  events:normalized.events.map(event=>({id:event.id,status:event.status,note:event.note,has_proof:false,created_at:event.createdAt}))};
 return {workspaceId,isOwner:envelope.data.isOwner,shipment};
}
