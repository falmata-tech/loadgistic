import {publicAsset} from './mobile/public-contract.js';
import {publicTruckAuthority} from './public-truck-authority.js';
import {locationSourceKind} from './location-source.js';
// A selected city coordinate and a saved obscured Driver fix are different facts.
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const text=value=>typeof value==='string'?value:'';
const coordinate=(lat,lng)=>typeof lat==='number'&&Number.isFinite(lat)&&Math.abs(lat)<=90
 &&typeof lng==='number'&&Number.isFinite(lng)&&Math.abs(lng)<=180;
export function trackingRoute(value){
 const shipment=object(value);
 const source=Array.isArray(shipment.route)?shipment.route:['origin',...(shipment.passing_place_ref?['passing']:[]),'destination'].map(name=>({
  placeRef:shipment[`${name}_place_ref`],label:shipment[name],coordinate:[shipment[`${name}_lng`],shipment[`${name}_lat`]]}));
 if(source.length<2||source.length>3)return[];
 const points=[];
 for(const value of source){const point=object(value),pair=point.coordinate;
  if(!text(point.placeRef)||!text(point.label)||!Array.isArray(pair)||pair.length!==2||!coordinate(pair[1],pair[0]))return[];
  points.push({placeRef:point.placeRef,label:point.label,coordinate:[pair[0],pair[1]]});
 }
 return new Set(points.map(point=>point.placeRef)).size===points.length?points:[];
}
export function trackingMapLocation(value){
 const shipment=object(value);
 if(shipment.can_view_location===false||shipment.tracking_mode!=='LOCATION_AND_STATUS'||['COMPLETED','CANCELLED'].includes(shipment.operational_status))return null;
 const location=object(Object.hasOwn(shipment,'current_location')?shipment.current_location:shipment.latest_location);
 if(!coordinate(location.location_lat,location.location_lng)||![1,3,5,10,20].includes(location.location_precision_km))return null;
 const updatedAt=text(location.updated_at)||text(location.created_at);
 const source=locationSourceKind(location.location_source);
 return updatedAt?{latitude:location.location_lat,longitude:location.location_lng,area:text(location.location_area),radius:location.location_precision_km,updatedAt,...(source?{source}:{}),...(location.is_demo===true?{demo:true}:{})}:null;
}
export function trackingPublicTruck(value){
 const summary=object(object(value).public_truck_summary);
 if(!Object.keys(summary).length)return null;
 return {...Object.fromEntries(['platformNumber','make','model','configuration','providerName','providerHandle','driverName','driverPhone','contactPhone'].map(key=>[key,text(summary[key])])),driverPortrait:publicAsset(summary.driverPortrait),...(summary.authority?{authority:publicTruckAuthority(summary.authority)}:{})};
}
