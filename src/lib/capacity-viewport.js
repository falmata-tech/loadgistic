export const MAX_MAP_TRUCKS=140;
// Public map bounds contain no device location. Exact visitor GPS stays client-only.
export function parseCapacityViewport(value){
 if(value===undefined||value===null||value==='')return null;
 const parts=Array.isArray(value)?value:String(value).split(',');
 if(parts.length!==4||parts.some(part=>part===null||String(part).trim()===''))throw new Error('INVALID_CAPACITY_VIEWPORT');
 const [west,south,east,north]=parts.map(Number);
 if(![west,south,east,north].every(Number.isFinite)||west< -180||east>180||south< -85||north>85||west>=east||south>=north)throw new Error('INVALID_CAPACITY_VIEWPORT');
 return [west,south,east,north];
}
export function retainMapTrucks(current,incoming,selectedId,{replace=false,limit=MAX_MAP_TRUCKS}={}){
 const bound=Math.max(1,Math.min(MAX_MAP_TRUCKS,Number(limit)||MAX_MAP_TRUCKS));
 const items=new Map((replace?[]:current).map(item=>[item.id,item]));
 for(const item of incoming)items.set(item.id,item);
 const selected=incoming.find(item=>item.id===selectedId)||current.find(item=>item.id===selectedId);
 const result=[...items.values()].filter(item=>item.id!==selected?.id).slice(-(bound-(selected?1:0)));
 if(selected)return [selected,...(bound===1?[]:result)];
 return result;
}
export function capacityDatabaseFilters(filters={},places=[]){
 const [origin,destination,area]=places;
 const radius=value=>{const n=Number(value);return Number.isFinite(n)&&n>=5&&n<=300?n:50;};
 const lat=Number(filters.nearLat),lng=Number(filters.nearLng);
 const hasNear=filters.nearLat!==''&&filters.nearLng!==''&&Number.isFinite(lat)&&lat>=3&&lat<=15&&Number.isFinite(lng)&&lng>=32&&lng<=49;
 const viewport=parseCapacityViewport(filters.viewport);
 return {
  capacity_id:filters.capacityId||null,provider:filters.provider||null,status:filters.status||null,geometry:filters.geometry||null,
  vehicle_category:filters.vehicleCategory||null,load_type:filters.loadType||null,stop_option:filters.stopOption||null,freshness:filters.freshness||null,q:filters.q||null,
  origin_lat:origin?.center_lat??null,origin_lng:origin?.center_lng??null,origin_radius_km:radius(filters.originRadiusKm),
  destination_lat:destination?.center_lat??null,destination_lng:destination?.center_lng??null,destination_radius_km:radius(filters.destinationRadiusKm),
  area_lat:area?.center_lat??null,area_lng:area?.center_lng??null,area_radius_km:radius(filters.currentAreaRadiusKm),
  direction_mode:filters.directionMode==='EITHER'?'EITHER':'DIRECT',near_lat:hasNear?lat:null,near_lng:hasNear?lng:null,
  near_radius_km:[5,10,20,50,100].includes(Number(filters.nearRadiusKm))?Number(filters.nearRadiusKm):20,
  ...(viewport?{viewport}:{})
 };
}
