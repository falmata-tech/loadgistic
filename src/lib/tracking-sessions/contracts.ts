import {z} from 'zod';
import {dateOnly} from '../date-calendar.js';

export const trackingSessionId=z.string().uuid();
export const trackingLinkToken=z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const trackingLinkCode=z.string().trim().toUpperCase().transform(value=>value.replace(/-/g,''))
 .pipe(z.string().regex(/^[0-9A-HJKMNP-TV-Z]{8}$/));
export const brokerReference=z.string().trim().max(80).regex(/^[^\u0000-\u001f\u007f-\u009f]*$/u);
const date=z.string().refine(value=>value===''||Boolean(dateOnly(value)));
export const trackingRoutePoint=z.object({placeRef:z.string().min(1).max(150),label:z.string().min(1).max(150),coordinate:z.tuple([z.number().finite().min(-180).max(180),z.number().finite().min(-90).max(90)])}).strict();
export const trackingSessionLink=z.object({id:trackingSessionId,createdAt:z.string(),expiresAt:z.string(),revokedAt:z.string().nullable(),allowLocation:z.boolean()}).strict();
const location=z.object({coordinate:trackingRoutePoint.shape.coordinate,radiusKm:z.number().positive().max(20),label:z.string(),updatedAt:z.string(),source:z.enum(['GPS','MOBILE']),demo:z.literal(true).optional()}).strict();
export const trackingSessionView=z.object({
 id:trackingSessionId,reference:z.string(),brokerReference:brokerReference.optional(),requestExpired:z.boolean().optional(),state:z.enum(['PENDING_PROVIDER','CONNECTED','CANCELLED']),revision:z.number().int().nonnegative(),
 workspaceId:trackingSessionId.nullable(),shipmentId:trackingSessionId.nullable(),route:z.array(trackingRoutePoint).min(2).max(3),cargoSummary:z.string(),pickupDate:date,deliveryDate:date,
 capabilities:z.object({canIssueLink:z.boolean(),canRevokeLink:z.boolean(),canAcceptProvider:z.boolean(),canApprove:z.boolean().optional(),canReadProof:z.boolean().optional(),canReview:z.boolean().optional(),canManageTeam:z.boolean().optional()}).strict(),links:z.array(trackingSessionLink).max(100),
 tracking:z.object({shipmentId:trackingSessionId,code:z.string(),status:z.string(),updatedAt:z.string(),trackingMode:z.enum(['STATUS_ONLY','LOCATION_AND_STATUS']),location:location.nullable(),events:z.array(z.object({id:trackingSessionId,status:z.string(),note:z.string(),createdAt:z.string(),hasProof:z.boolean().optional()}).strict()).max(1000),review:z.object({rating:z.number().int().min(1).max(5),note:z.string(),createdAt:z.string().optional()}).strict().nullable().optional()}).strict().nullable()
}).strict();
export type TrackingSessionView=z.infer<typeof trackingSessionView>;
export type TrackingSessionLink=z.infer<typeof trackingSessionLink>;
export type TrackingSessionAccess={session:TrackingSessionView;grant:string;expiresAt:string};
export type TrackingSessionIssue={link:{id:string;url:string;code:string;expiresAt:string;allowLocation:boolean}};
export const trackingSessionCreate=z.object({workspaceId:trackingSessionId,route:z.array(z.object({placeRef:z.string().trim().min(1).max(150)}).strict()).min(2).max(3),brokerReference:brokerReference.optional(),cargoDescription:z.string().trim().min(3).max(500),pickupDate:date,deliveryDate:z.string().refine(value=>Boolean(dateOnly(value)))}).strict()
 .refine(input=>new Set(input.route.map(point=>point.placeRef)).size===input.route.length,{message:'Choose different cities.'})
 .refine(input=>!input.pickupDate||input.deliveryDate>=input.pickupDate,{message:'Delivery cannot be before pickup.'});
export const trackingSessionReferenceSearch=z.object({workspaceId:trackingSessionId,page:z.number().int().min(1).max(10000),reference:brokerReference.refine(value=>value.length>0)}).strict();
export const trackingSessionIssueInput=z.object({workspaceId:trackingSessionId.optional(),expiresInDays:z.number().int().min(1).max(30).default(7),allowLocation:z.boolean()}).strict();
export const trackingSessionConnect=z.object({linkToken:trackingLinkToken,code:trackingLinkCode,vehicleId:trackingSessionId,trackingMode:z.enum(['STATUS_ONLY','LOCATION_AND_STATUS'])}).strict();
export type TrackingSessionCreate=z.infer<typeof trackingSessionCreate>;
export const trackingSessionViewSchema=trackingSessionView;
export const trackingSessionAccessSchema=z.object({session:trackingSessionView,grant:z.string().min(1),expiresAt:z.string()}).strict();
export const trackingSessionIssueSchema=z.object({link:z.object({id:trackingSessionId,url:z.string().url(),code:z.string().regex(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/),expiresAt:z.string(),allowLocation:z.boolean()}).strict()}).strict();
export const trackingSessionListSchema=z.object({workspaceId:trackingSessionId.nullable(),total:z.number().int().nonnegative(),page:z.number().int().positive(),pageCount:z.number().int().positive(),sessions:z.array(trackingSessionView).max(50)}).strict();
