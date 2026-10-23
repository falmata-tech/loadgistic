export type TrackingRoutePoint={placeRef:string;label:string;coordinate:[number,number]};
export type TrackingMapLocation={latitude:number;longitude:number;area:string;radius:number;updatedAt:string;source?:'GPS'|'MOBILE'|'MANUAL'|null;demo?:true};
export type TrackingPublicTruck={platformNumber:string;make:string;model:string;configuration:string;providerName:string;providerHandle:string;driverName:string;driverPhone:string;contactPhone:string;driverPortrait:string;authority?:import('./provider-authority.js').TruckAuthority};
export function trackingRoute(value:unknown):TrackingRoutePoint[];
export function trackingMapLocation(value:unknown):TrackingMapLocation|null;
export function trackingPublicTruck(value:unknown):TrackingPublicTruck|null;
