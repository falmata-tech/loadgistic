import {trackingRoute,trackingMapLocation,trackingPublicTruck} from '@/lib/tracking-map.js';

export type TrackingRoutePoint={placeRef:string;label:string;coordinate:[number,number]};
export type TrackingReportedLocation={coordinate:[number,number];radiusKm:number;label:string;updatedAt:string;source?:'GPS'|'MOBILE'|'MANUAL'|null;demo?:true};
export type TrackingPublicTruck={platformNumber:string;make:string;model:string;configuration:string;providerName:string;providerHandle:string;driverName:string;driverPhone:string;contactPhone:string;authority?:import('@/lib/provider-authority.js').TruckAuthority};
export type TrackingMapData={route:TrackingRoutePoint[];location:TrackingReportedLocation|null;truck:TrackingPublicTruck|null;status:string;trackingMode:string;recordedStatuses:string[]};

function record(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function text(value:unknown):string{return typeof value==='string'?value:'';}
/** Rendering projection only. Server/PostgreSQL still authorize every shipment read. */
export function trackingMapData(value:unknown):TrackingMapData{
  const source=record(value),status=text(source.operational_status),trackingMode=source.can_view_location===false?'STATUS_ONLY':text(source.tracking_mode);
  const route=trackingRoute(source).map((point):TrackingRoutePoint=>({...point,coordinate:[point.coordinate[0],point.coordinate[1]]}));
  const reported=trackingMapLocation(source);
  const location:TrackingReportedLocation|null=reported?{coordinate:[reported.longitude,reported.latitude],radiusKm:reported.radius,label:reported.area,updatedAt:reported.updatedAt,...(reported.source?{source:reported.source}:{}),...(reported.demo===true?{demo:true as const}:{})}:null;
  const summary=trackingPublicTruck(source);
  const truck:TrackingPublicTruck|null=summary?{platformNumber:summary.platformNumber,make:summary.make,model:summary.model,configuration:summary.configuration,providerName:summary.providerName,providerHandle:summary.providerHandle,driverName:summary.driverName,driverPhone:summary.driverPhone,contactPhone:summary.contactPhone,...(summary.authority?{authority:summary.authority}:{})}:null;
  const events=Array.isArray(source.events)?source.events:[];
  return {route,location,truck,status,trackingMode,recordedStatuses:events.map(event=>text(record(event).status)).filter(Boolean)};
}
