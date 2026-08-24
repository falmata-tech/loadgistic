import { createSupabaseAdminClient } from '../supabase-adapter.js';
import {BUSINESS_SEARCH_PRIVACY_KM,possibleDistanceRange} from '../location-privacy.js';
import {capacityRouteAlignmentMatch,capacityRoutePointMatch,normalizePlace,serviceAreaGeometryMatch} from '../route-matching.js';

const PLACE_TYPE_ORDER=new Map([
  ['city',0],['town',1],['suburb',2],['neighbourhood',3],['quarter',4],['village',5]
]);

function safeSearchToken(value){
  return String(value||'').replace(/[,%()_*]/g,' ').replace(/\s+/g,' ').trim().slice(0,120);
}

export async function searchSupabasePlaces(query,normalized,limit=20){
  const boundedLimit=Math.max(1,Math.min(Number(limit)||20,50));
  const normalizedToken=safeSearchToken(normalized);
  const rawToken=safeSearchToken(query);
  if(normalizedToken.length<2)return [];
  const client=createSupabaseAdminClient();
  const filters=[`normalized_name.ilike.*${normalizedToken}*`];
  if(rawToken.length>=2)filters.push(`alternate_names.ilike.*${rawToken}*`);
  const {data,error}=await client.from('place_catalog')
    .select('id,name,normalized_name,alternate_names,place_type,latitude,longitude,population,wikidata_id,source,parent_name,country_name,country_code')
    .or(filters.join(','))
    .limit(Math.max(100,boundedLimit*4));
  if(error)throw new Error('SUPABASE_PLACE_SEARCH_FAILED',{cause:error});
  return projectSupabasePlaces(data,normalizedToken,boundedLimit);
}

export function projectSupabasePlaces(data,normalizedToken,limit=20){
  const boundedLimit=Math.max(1,Math.min(Number(limit)||20,50));
  return (data||[]).sort((first,second)=>{
    const firstName=String(first.normalized_name||'');
    const secondName=String(second.normalized_name||'');
    const firstMatch=firstName===normalizedToken?0:firstName.startsWith(normalizedToken)?1:2;
    const secondMatch=secondName===normalizedToken?0:secondName.startsWith(normalizedToken)?1:2;
    if(firstMatch!==secondMatch)return firstMatch-secondMatch;
    const firstType=PLACE_TYPE_ORDER.get(String(first.place_type))??6;
    const secondType=PLACE_TYPE_ORDER.get(String(second.place_type))??6;
    if(firstType!==secondType)return firstType-secondType;
    const populationDifference=Number(second.population||0)-Number(first.population||0);
    if(populationDifference!==0)return populationDifference;
    return String(first.name).localeCompare(String(second.name));
  }).slice(0,boundedLimit).map(place=>({
    id:place.id,
    name:place.name,
    display_name:[place.name,place.parent_name&&String(place.parent_name).toLowerCase()!==String(place.name).toLowerCase()?place.parent_name:null,place.country_name].filter(Boolean).join(', '),
    country_name:place.country_name,country_code:place.country_code,parent_name:place.parent_name,
    place_type:place.place_type,lat:place.latitude,lng:place.longitude,population:place.population,
    wikidata_id:place.wikidata_id,source:place.source
  }));
}

function publicBoardTime(value){
  if(!value)return null;
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return String(value);
  return new Intl.DateTimeFormat('en-US',{
    timeZone:'Africa/Addis_Ababa',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'
  }).format(date);
}

function ethiopiaDate(){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Addis_Ababa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}

function encodePublicCursor(row){
  return Buffer.from(JSON.stringify([row.updated_at,row.id]),'utf8').toString('base64url');
}

function decodePublicCursor(value){
  if(!value)return null;
  try{
    const parsed=JSON.parse(Buffer.from(String(value),'base64url').toString('utf8'));
    if(!Array.isArray(parsed)||parsed.length!==2||!parsed.every(item=>typeof item==='string'))return null;
    return {updatedAt:parsed[0],id:parsed[1]};
  }catch{return null;}
}

function validPlacePoints(value,minimum){
  const source=Array.isArray(value)?value:[];
  const points=source.slice(0,5).map(point=>({
    key:String(point?.key||''),label:String(point?.label||''),place_ref:String(point?.place_ref||''),
    lat:Number(point?.lat),lng:Number(point?.lng)
  })).filter(point=>Number.isFinite(point.lat)&&Number.isFinite(point.lng));
  return points.length>=minimum?points:[];
}

function verificationBadges(subjectType,records){
  const latest=new Map();
  for(const record of records||[])if(!latest.has(record.verification_type))latest.set(record.verification_type,record);
  const required=subjectType==='VEHICLE'
    ?[latest.has('VEHICLE_AUTHORIZATION')?'VEHICLE_AUTHORIZATION':'VEHICLE_OWNERSHIP']
    :['IDENTITY','DRIVER_IDENTITY'];
  const today=ethiopiaDate();
  return required.map(type=>{
    const record=latest.get(type);
    const expired=Boolean(record?.expires_on&&record.expires_on<today);
    return {type,verified:Boolean(record&&!expired),expired,reviewedAt:record?.reviewed_at||null,expiresOn:record?.expires_on||null};
  });
}

function truckAuthorizationBadge(records,vehicleId,vehicleLabel){
  const record=(records||[]).find(item=>item.verification_type==='VEHICLE_AUTHORIZATION'&&item.related_vehicle_id===vehicleId);
  const expired=Boolean(record?.expires_on&&record.expires_on<ethiopiaDate());
  return {type:'TRUCK_AUTHORIZATION',verified:Boolean(record&&!expired),expired,
    reviewedAt:record?.reviewed_at||null,expiresOn:record?.expires_on||null,vehicleId,vehicleLabel};
}

function providerKindLabel(value){
  if(value==='FLEET_TRANSPORTER')return 'Company driver';
  if(value==='OWNER_OPERATOR')return 'Owner-operator';
  return 'Self-managed driver';
}

async function resolveSupabasePlace(client,placeRef,label){
  const reference=String(placeRef||'').trim();
  if(reference){
    const {data,error}=await client.from('place_catalog')
      .select('id,name,parent_name,country_name,latitude,longitude').eq('id',reference).maybeSingle();
    if(error)throw new Error('SUPABASE_PLACE_LOOKUP_FAILED',{cause:error});
    if(data)return {place_ref:data.id,place_label:[data.name,data.parent_name&&data.parent_name!==data.name?data.parent_name:null,data.country_name].filter(Boolean).join(', '),center_lat:Number(data.latitude),center_lng:Number(data.longitude)};
  }
  const normalized=normalizePlace(label);
  if(normalized.length<2)return null;
  const {data,error}=await client.from('place_catalog')
    .select('id,name,parent_name,country_name,latitude,longitude').eq('normalized_name',normalized)
    .order('population',{ascending:false,nullsFirst:false}).limit(1).maybeSingle();
  if(error)throw new Error('SUPABASE_PLACE_LOOKUP_FAILED',{cause:error});
  return data?{place_ref:data.id,place_label:[data.name,data.parent_name&&data.parent_name!==data.name?data.parent_name:null,data.country_name].filter(Boolean).join(', '),center_lat:Number(data.latitude),center_lng:Number(data.longitude)}:null;
}

function boundedRadius(value){
  const radius=Number(value);
  return Number.isFinite(radius)&&radius>=5&&radius<=300?radius:50;
}

function geographicMatchLabel(item,filters,originPlace,destinationPlace,areaPlace){
  if(originPlace&&destinationPlace){
    const query={origin_lat:originPlace.center_lat,origin_lng:originPlace.center_lng,destination_lat:destinationPlace.center_lat,destination_lng:destinationPlace.center_lng};
    const routes=[];
    if(item.availability_geometry==='ROUTE')routes.push({points:item.current_route_points,source:'Current capacity route',directionMode:filters.directionMode==='EITHER'?'EITHER':'DIRECT'});
    for(const signal of item.recurring_corridors.filter(entry=>entry.geometry==='ROUTE'))routes.push({points:signal.route_points,source:'Regular capacity route',directionMode:'EITHER'});
    const routeMatch=routes.map(route=>({...route,...capacityRouteAlignmentMatch(query,route.points,{originRadiusKm:filters.originRadiusKm,destinationRadiusKm:filters.destinationRadiusKm,directionMode:route.directionMode})}))
      .filter(route=>route.matched).sort((first,second)=>first.origin_distance_km+first.destination_distance_km-(second.origin_distance_km+second.destination_distance_km))[0];
    const areas=[];
    if(item.status==='EMPTY'&&item.availability_geometry==='RADIUS')areas.push({points:item.capacity_area_boundary,source:'Current Service area'});
    if(item.status==='EMPTY')for(const signal of item.recurring_corridors.filter(entry=>entry.geometry==='RADIUS'))areas.push({points:signal.area_boundary,source:'Regular Service area'});
    const areaMatch=areas.map(area=>{
      const origin=serviceAreaGeometryMatch({lat:originPlace.center_lat,lng:originPlace.center_lng},area.points,{searchRadiusKm:filters.originRadiusKm});
      const destination=serviceAreaGeometryMatch({lat:destinationPlace.center_lat,lng:destinationPlace.center_lng},area.points,{searchRadiusKm:filters.destinationRadiusKm});
      return {...area,origin,destination,matched:origin.matched&&destination.matched,total:Number(origin.distance_km||0)+Number(destination.distance_km||0)};
    }).filter(area=>area.matched).sort((first,second)=>first.total-second.total)[0];
    if(routeMatch)return `${routeMatch.source} aligns · ${Math.round(routeMatch.origin_distance_km)} km / ${Math.round(routeMatch.destination_distance_km)} km`;
    if(areaMatch)return `${areaMatch.source} covers both shipment endpoints`;
  }
  if(originPlace||destinationPlace){
    const point=originPlace||destinationPlace;
    const radius=originPlace?filters.originRadiusKm:filters.destinationRadiusKm;
    const routes=[];
    if(item.availability_geometry==='ROUTE')routes.push({points:item.current_route_points,source:'Current capacity route'});
    for(const signal of item.recurring_corridors.filter(entry=>entry.geometry==='ROUTE'))routes.push({points:signal.route_points,source:'Regular capacity route'});
    const routeMatch=routes.map(route=>({...route,...capacityRoutePointMatch({lat:point.center_lat,lng:point.center_lng},route.points,{radiusKm:radius})})).find(route=>route.matched);
    const areas=[];
    if(item.status==='EMPTY'&&item.availability_geometry==='RADIUS')areas.push({points:item.capacity_area_boundary,source:'Current Service area'});
    if(item.status==='EMPTY')for(const signal of item.recurring_corridors.filter(entry=>entry.geometry==='RADIUS'))areas.push({points:signal.area_boundary,source:'Regular Service area'});
    const areaMatch=areas.map(area=>({...area,...serviceAreaGeometryMatch({lat:point.center_lat,lng:point.center_lng},area.points,{searchRadiusKm:radius})}))
      .filter(area=>area.matched).sort((first,second)=>Number(first.distance_km||0)-Number(second.distance_km||0))[0];
    if(routeMatch)return `${routeMatch.source} passes within ${Math.round(routeMatch.distance_km)} km of ${point.place_label}`;
    if(areaMatch)return `${areaMatch.source} reaches ${point.place_label}${areaMatch.inside?'':' nearby'}`;
  }
  if(areaPlace){
    const areas=[];
    if(item.status==='EMPTY'&&item.availability_geometry==='RADIUS')areas.push({points:item.capacity_area_boundary,source:'Current Service area'});
    if(item.status==='EMPTY')for(const signal of item.recurring_corridors.filter(entry=>entry.geometry==='RADIUS'))areas.push({points:signal.area_boundary,source:'Regular Service area'});
    const match=areas.map(area=>({...area,...serviceAreaGeometryMatch({lat:areaPlace.center_lat,lng:areaPlace.center_lng},area.points,{searchRadiusKm:filters.currentAreaRadiusKm})}))
      .filter(area=>area.matched).sort((first,second)=>first.distance_km-second.distance_km)[0];
    if(match)return `${match.source} reaches ${areaPlace.place_label}${match.inside?'':' nearby'}`;
  }
  if(Number.isFinite(Number(filters.nearLat))&&Number.isFinite(Number(filters.nearLng)))return 'Approximate truck location is within your selected proximity';
  return null;
}

export async function listSupabasePublicCapacityCursor(filters={},options={}){
  const client=createSupabaseAdminClient();
  const pageSize=Math.max(12,Math.min(16,Number(options.pageSize)||14));
  const cursor=decodePublicCursor(options.cursor);
  const [originPlace,destinationPlace,areaPlace]=await Promise.all([
    resolveSupabasePlace(client,filters.originPlaceRef,filters.origin),
    resolveSupabasePlace(client,filters.destinationPlaceRef,filters.destination),
    resolveSupabasePlace(client,filters.currentAreaPlaceRef,filters.currentArea)
  ]);
  const nearLat=Number(filters.nearLat),nearLng=Number(filters.nearLng);
  const hasNear=Number.isFinite(nearLat)&&nearLat>=3&&nearLat<=15&&Number.isFinite(nearLng)&&nearLng>=32&&nearLng<=49;
  const query={
    capacity_id:filters.capacityId||null,provider_organization_id:filters.providerOrganizationId||null,
    provider_profile_id:filters.providerProfileId||null,provider:filters.provider||null,status:filters.status||null,
    geometry:filters.geometry||null,vehicle_category:filters.vehicleCategory||null,load_type:filters.loadType||null,
    stop_option:filters.stopOption||null,freshness:filters.freshness||null,q:filters.q||null,
    origin_lat:originPlace?.center_lat??null,origin_lng:originPlace?.center_lng??null,
    origin_radius_km:boundedRadius(filters.originRadiusKm),destination_lat:destinationPlace?.center_lat??null,
    destination_lng:destinationPlace?.center_lng??null,destination_radius_km:boundedRadius(filters.destinationRadiusKm),
    direction_mode:filters.directionMode==='EITHER'?'EITHER':'DIRECT',area_lat:areaPlace?.center_lat??null,
    area_lng:areaPlace?.center_lng??null,area_radius_km:boundedRadius(filters.currentAreaRadiusKm),
    near_lat:hasNear?nearLat:null,near_lng:hasNear?nearLng:null,near_radius_km:filters.nearRadiusKm||20
  };
  const {data,error}=await client.rpc('public_capacity_page',{
    query,cursor_updated_at:cursor?.updatedAt||null,cursor_id:cursor?.id||null,requested_page_size:pageSize
  });
  if(error)throw new Error('SUPABASE_PUBLIC_CAPACITY_FAILED',{cause:error});
  const rows=(data||[]).map(row=>row.payload||row);
  const hasMore=rows.length>pageSize;
  const selected=rows.slice(0,pageSize);
  const items=selected.map(row=>{
    const recurring=(row.recurring_corridors||[]).slice(0,1).map(signal=>({
      ...signal,geometry:signal.geometry==='RADIUS'?'RADIUS':'ROUTE',
      route_points:validPlacePoints(signal.route_points,signal.geometry==='RADIUS'?0:2),
      area_boundary:validPlacePoints(signal.area_boundary,signal.geometry==='RADIUS'?3:0)
    }));
    const distance=hasNear&&row.near_center_distance_km!=null
      ?possibleDistanceRange(Number(row.near_center_distance_km),Number(row.location_precision_km||20),BUSINESS_SEARCH_PRIVACY_KM):null;
    const driverKind=row.provider_kind==='FLEET_TRANSPORTER'?'COMPANY_DRIVER':row.provider_kind;
    const base={...row,provider_kind:undefined,driver_documents:undefined,vehicle_documents:undefined,authorization_documents:undefined,
      recurring_corridors:recurring,current_route_points:validPlacePoints(row.current_route_points,row.availability_geometry==='ROUTE'?2:0),
      capacity_area_boundary:validPlacePoints(row.capacity_area_boundary,row.availability_geometry==='RADIUS'?3:0),
      driver_kind:driverKind,driver_kind_label:providerKindLabel(row.provider_kind),
      driver_verification_badges:verificationBadges(row.provider_kind==='FLEET_TRANSPORTER'?'DRIVER':'PROVIDER_PROFILE',row.driver_documents),
      truck_verification_badges:row.provider_kind==='OWNER_OPERATOR'
        ?verificationBadges('VEHICLE',row.vehicle_documents)
        :[truckAuthorizationBadge(row.authorization_documents,row.vehicle_id,row.platform_number)],
      possible_distance_min_km:distance?.minKm??null,possible_distance_max_km:distance?.maxKm??null,
      near_center_distance_km:undefined,updated_label:publicBoardTime(row.updated_at),
      accepts_full_load:Boolean(row.accepts_full_load),accepts_partial_load:Boolean(row.accepts_partial_load),
      accepts_multi_pick:Boolean(row.accepts_multi_pick),accepts_multi_drop:Boolean(row.accepts_multi_drop)
    };
    return {...base,geographic_match_label:geographicMatchLabel(base,filters,originPlace,destinationPlace,areaPlace)};
  });
  return {items,nextCursor:hasMore?encodePublicCursor(selected.at(-1)):null,hasMore,pageSize};
}
