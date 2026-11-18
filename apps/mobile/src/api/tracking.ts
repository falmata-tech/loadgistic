import {locationSourceKind} from '../../../../src/lib/location-source.js';
export type TrackingSummary = { id: string; code: string; origin: string; destination: string; cargo: string; status: string; driver: string; truck: string; updatedAt: string };
export type TrackingWorkspace = { canManage: boolean; vehicles: { id: string; label: string }[]; shipments: TrackingSummary[] };
export type TrackingRoutePoint={placeRef:string;label:string;coordinate:number[]};
export type TrackingPublicTruck={platformNumber:string;make:string;model:string;configuration:string;providerName:string;providerHandle:string;driverName:string;driverPhone:string;contactPhone:string;authority?:import('./public-content').TruckAuthority};
export type TrackingLocation={latitude:number;longitude:number;area:string;radius:number;updatedAt:string;source?:'GPS'|'MOBILE'|null;demo?:true};
export type TrackingDetail = TrackingSummary & { route:TrackingRoutePoint[];publicTruck:TrackingPublicTruck|null;mode: string; appeals: {id:string;reason:string;status:string;resolutionNote:string}[]; canRecover: boolean; nextStatuses: string[]; canLocate: boolean; pickupDate: string; deliveryDate: string; canManageRecipients: boolean; canAddPartner?:boolean; location: TrackingLocation | null; events: { id: string; status: string; note: string; hasProof: boolean; createdAt: string }[]; recipients: { id: string; email: string; owner: boolean; revoked: boolean }[]; deliveries: { kind: string; status: string }[] };
const labels: Record<string, string> = { CREATED: 'Ready to start', TO_PICKUP: 'Going to pickup', LOADING: 'Loading', IN_TRANSIT: 'On the way', UNLOADING: 'Unloading', COMPLETED: 'Completed', ISSUE: 'Issue reported', CANCELLED: 'Cancelled' };
export const statusLabel = (value: string) => labels[value] || value;

// Old clients can still receive retired provenance from a prior API. Keep its
// stored history separate from the current location shown to a recipient.
export function currentTrackingLocation(value:TrackingLocation|null):TrackingLocation|null{
 if(value?.source!=null&&!locationSourceKind(value.source))return null;
 return value;
}
