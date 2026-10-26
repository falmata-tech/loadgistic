import {capacityFilterValue,CAPACITY_FILTER_CHOICES,type CapacityFilterKey} from '../../../../src/lib/capacity-filter-values.js';
export {capacityFilterValues,capacityFilterValue} from '../../../../src/lib/capacity-filter-values.js';
export type TruckFilters = {
 blocked?:string;
 status?:string; loadType?:string; vehicleCategory?:string;
 stopOption?:string; freshness?:string; locationSource?:string;
 directionMode?: ''|'DIRECT'|'EITHER'; ownerDocs?:string; driverDocs?:string; truckDocs?:string;
 truckCityPlaceRef?:string; truckCityLabel?:string; truckLocationRadiusKm?:string;
 currentAreaPlaceRef?:string; currentAreaLabel?:string; currentAreaRadiusKm?:string;
 originPlaceRef?:string; originLabel?:string; originRadiusKm?:string;
 destinationPlaceRef?:string; destinationLabel?:string; destinationRadiusKm?:string;
 nearLat?:string; nearLng?:string; nearRadiusKm?:string; provider?:string; truck?:string;
};
const keys=['blocked','status','loadType','vehicleCategory','stopOption','freshness','locationSource','directionMode','ownerDocs','driverDocs','truckDocs','truckCityPlaceRef','truckLocationRadiusKm','currentAreaPlaceRef','currentAreaRadiusKm','originPlaceRef','originRadiusKm','destinationPlaceRef','destinationRadiusKm','nearLat','nearLng','nearRadiusKm','provider','truck'] as const;
export function discoveryParams(query:string,filters:TruckFilters={},page?:number) {
 const params=new URLSearchParams(); if(query.trim())params.set('q',query.trim());
 for(const key of keys) if(filters[key])params.set(key,key in CAPACITY_FILTER_CHOICES?capacityFilterValue(key as CapacityFilterKey,filters[key]):filters[key]!);
 if(page)params.set('page',String(page)); return params;
}
/** Account search is independent of the map; opening a result selects its provider. */
export function peopleSearchFilters(filters:TruckFilters):TruckFilters{const {provider:_provider,truck:_truck,...truckFilters}=filters;return truckFilters;}
export function profileTruckFilters(filters:TruckFilters,profile:Pick<ProfileResult,'handle'>):TruckFilters{return {...filters,provider:profile.handle,truck:''};}
export function initialCapacityIdentity(params:Record<string,unknown>):TruckFilters{
 return {provider:typeof params.provider==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$/.test(params.provider)?params.provider:'',truck:typeof params.truck==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.truck)?params.truck:''};
}
export function filterCount(filters:TruckFilters) { return ['status','loadType','vehicleCategory','stopOption','freshness','locationSource','ownerDocs','driverDocs','truckDocs','truckCityPlaceRef','currentAreaPlaceRef','originPlaceRef','destinationPlaceRef','nearLat','provider','truck'].filter(key=>Boolean(filters[key as keyof TruckFilters])).length; }
export function changeSpace(filters:TruckFilters,loadType:TruckFilters['loadType']):TruckFilters {return {...filters,loadType,...(loadType==='FTL'&&filters.status==='PARTIAL'?{status:''}:{})};}
export function changeAvailability(filters:TruckFilters,status:TruckFilters['status']):TruckFilters{return {...filters,status,...(status==='PARTIAL'&&filters.loadType==='FTL'?{loadType:''}:{})};}
export type ProfileResult = {key:string;kind:'COMPANY'|'OWNER_OPERATOR'|'SELF_MANAGED_DRIVER';title:string;accountName?:string;managerName?:string;description:string;handle:string;city:string;matchingTrucks:number;capacityId:string};
export type DiscoveryResult={items:ProfileResult[];total:number;page:number;hasMore:boolean;configurations:{name:string;image:string}[]};
const kinds=new Set(['COMPANY','OWNER_OPERATOR','SELF_MANAGED_DRIVER']);
export function parseDiscovery(value:unknown):DiscoveryResult {
 if(!value||typeof value!=='object')throw new Error('Invalid search response');
 const result=value as Record<string,unknown>;
 if(!Array.isArray(result.items)||typeof result.hasMore!=='boolean'||!Number.isInteger(result.page)||!Number.isInteger(result.total)||!Array.isArray(result.configurations))throw new Error('Invalid search response');
 const items=result.items.map((raw:unknown)=>{
  if(!raw||typeof raw!=='object')throw new Error('Invalid search result');
  const row=raw as Record<string,unknown>;
  if(!kinds.has(String(row.kind))||!['key','title','description','handle','city','capacityId'].every(key=>typeof row[key]==='string')||!Number.isInteger(row.matchingTrucks)||Number(row.matchingTrucks)<1)throw new Error('Invalid search result');
  return {accountName:typeof row.accountName==='string'?row.accountName:String(row.title),managerName:typeof row.managerName==='string'?row.managerName:'',key:row.key,kind:row.kind,title:row.title,description:row.description,handle:row.handle,city:row.city,capacityId:row.capacityId,matchingTrucks:row.matchingTrucks} as ProfileResult;
 });
 const configurations=result.configurations.flatMap((raw:unknown)=>{
  if(!raw||typeof raw!=='object')return[];const row=raw as Record<string,unknown>;
  return typeof row.name==='string'&&typeof row.image==='string'&&/^\/vehicle-configurations\/[a-z0-9-]+\.jpg$/.test(row.image)?[{name:row.name,image:row.image}]:[];
 });
 return {items,total:Number(result.total),page:Number(result.page),hasMore:result.hasMore,configurations};
}
