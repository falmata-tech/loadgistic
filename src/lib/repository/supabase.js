import { createSupabaseAdminClient } from '../supabase-adapter.js';
import {randomUUID} from 'node:crypto';
import {BUSINESS_SEARCH_PRIVACY_KM,possibleDistanceRange} from '../location-privacy.js';
import {capacityRouteAlignmentMatch,capacityRoutePointMatch,normalizePlace,serviceAreaGeometryMatch} from '../route-matching.js';
import {buildFeaturedDaySchedule,DEFAULT_FEATURED_SCHEDULE_CONFIG} from '../expo-broadcast.js';
import {providerRegionLabel,regionalExpoGroupForDate,regionalExpoWeekForDate} from '../provider-regions.js';
import {capacityUpdatePresentation,distanceBetweenKm,normalizePrivateContactEmail} from '../domain.js';
import {hashTrackingAccessCode,privateContactDigest,sharedCapacityOtpCode} from '../security.js';

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
    :subjectType==='ORGANIZATION'?['IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS']:['IDENTITY','DRIVER_IDENTITY'];
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
    const capacityAge=capacityUpdatePresentation(row.updated_at);
    const currentGeometryVisible=row.current_signal_geometry_visible!==false;
    const locationAge=currentGeometryVisible?capacityUpdatePresentation(row.location_updated_at,{kind:'location'}):null;
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
      capacity_update_stage:capacityAge.stage,capacity_updated_label:capacityAge.label,
      capacity_confirmation_needed:capacityAge.confirmAvailability,
      location_update_stage:locationAge?.stage??null,location_updated_label:locationAge?.label??null,
      location_is_last_reported:locationAge?.lastReported??null,
      accepts_full_load:Boolean(row.accepts_full_load),accepts_partial_load:Boolean(row.accepts_partial_load),
      accepts_multi_pick:Boolean(row.accepts_multi_pick),accepts_multi_drop:Boolean(row.accepts_multi_drop)
    };
    return {...base,geographic_match_label:geographicMatchLabel(base,filters,originPlace,destinationPlace,areaPlace)};
  });
  return {items,nextCursor:hasMore?encodePublicCursor(selected.at(-1)):null,hasMore,pageSize};
}

function managedCapacityError(code,error){
  const message=String(error?.message||'');
  if(/NOT_FOUND/.test(message))return new Error('NOT_FOUND');
  if(/FORBIDDEN/.test(message))return new Error('FORBIDDEN');
  if(/INVALID_EMAIL/.test(message))return new Error('INVALID_EMAIL');
  return new Error(code,{cause:error});
}

export async function listSupabasePrivateCapacityNetwork(user){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('private_capacity_network',{actor_user_id:user.id});
  if(error)throw managedCapacityError('SUPABASE_PRIVATE_CAPACITY_NETWORK_FAILED',error);
  return (data||[]).map(row=>row.payload||row);
}

export async function grantSupabasePrivateCapacityAccess(user,input){
  const email=normalizePrivateContactEmail(input.email);
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('grant_private_capacity_access',{
    actor_user_id:user.id,target_vehicle_id:String(input.vehicleId||''),
    normalized_recipient_email:email,recipient_digest:privateContactDigest(email)
  });
  if(error)throw managedCapacityError('SUPABASE_PRIVATE_CAPACITY_GRANT_FAILED',error);
  return data;
}

export async function setSupabaseLoadgisticCapacityAccess(user,vehicleId,enabled){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('set_loadgistic_capacity_access',{
    actor_user_id:user.id,target_vehicle_id:String(vehicleId||''),enabled:Boolean(enabled),
    platform_digest:privateContactDigest('loadgistic-platform')
  });
  if(error)throw managedCapacityError('SUPABASE_LOADGISTIC_CAPACITY_ACCESS_FAILED',error);
  return data;
}

export async function revokeSupabasePrivateCapacityAccess(user,grantId){
  const client=createSupabaseAdminClient();
  const {error}=await client.rpc('revoke_private_capacity_access',{
    actor_user_id:user.id,target_grant_id:String(grantId||'')
  });
  if(error)throw managedCapacityError('SUPABASE_PRIVATE_CAPACITY_REVOKE_FAILED',error);
}

export async function requestSupabaseSharedCapacityOtp(value){
  const email=normalizePrivateContactEmail(value),emailDigest=privateContactDigest(email);
  const challengeId=randomUUID(),accessCode=sharedCapacityOtpCode(challengeId);
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('request_shared_capacity_otp',{
    challenge_id:challengeId,normalized_recipient_email:email,recipient_digest:emailDigest,
    challenge_code_digest:hashTrackingAccessCode(accessCode),
    challenge_expires_at:new Date(Date.now()+10*60*1000).toISOString()
  });
  if(error)throw managedCapacityError('SUPABASE_SHARED_CAPACITY_OTP_REQUEST_FAILED',error);
  return data
    ?{accepted:true,deliveryQueued:true,challengeId,accessCode}
    :{accepted:true,deliveryQueued:false};
}

export async function verifySupabaseSharedCapacityAccess(value,code){
  const email=normalizePrivateContactEmail(value),emailDigest=privateContactDigest(email);
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('consume_shared_capacity_otp',{
    recipient_digest:emailDigest,submitted_code_digest:hashTrackingAccessCode(String(code||'').trim())
  });
  if(error||!data)throw new Error('SHARED_CAPACITY_ACCESS_DENIED',{cause:error||undefined});
  return {emailDigest};
}

function privateCapacitySearchText(item){
  return [item.provider_name,item.provider_handle,item.platform_number,item.vehicle_make,item.vehicle_model,
    item.cargo_configuration,item.location_area,item.capacity_area_center_label,
    ...(item.current_route_points||[]).map(point=>point.label),
    ...(item.capacity_area_boundary||[]).map(point=>point.label),
    ...(item.recurring_corridors||[]).flatMap(signal=>[
      ...(signal.route_points||[]).map(point=>point.label),...(signal.area_boundary||[]).map(point=>point.label),signal.area_center_label
    ])].filter(Boolean).join(' ').toLowerCase();
}

function sharedCapacityBasicMatch(item,filters){
  if(filters.capacityId&&item.id!==filters.capacityId)return false;
  if(filters.provider&&String(item.provider_handle||'').toLowerCase()!==String(filters.provider).toLowerCase())return false;
  if(filters.status&&item.status!==String(filters.status).toUpperCase())return false;
  if(filters.geometry){
    const geometry=String(filters.geometry).toUpperCase();
    if(item.status==='PARTIAL'&&geometry==='RADIUS')return false;
    if(item.availability_geometry!==geometry&&!item.recurring_corridors.some(signal=>signal.geometry===geometry))return false;
  }
  if(filters.vehicleCategory&&item.cargo_configuration!==filters.vehicleCategory)return false;
  if(filters.loadType==='FTL'&&!item.accepts_full_load)return false;
  if(filters.loadType==='PTL'&&!item.accepts_partial_load)return false;
  if(filters.stopOption==='MULTI_PICK'&&!item.accepts_multi_pick)return false;
  if(filters.stopOption==='MULTI_DROP'&&!item.accepts_multi_drop)return false;
  const age=Date.now()-new Date(item.updated_at).getTime();
  if(filters.freshness==='FRESH'&&age>12*60*60*1000)return false;
  if(filters.freshness==='UPDATE_NEEDED'&&age<=12*60*60*1000)return false;
  if(filters.q&&!privateCapacitySearchText(item).includes(String(filters.q).trim().toLowerCase()))return false;
  return true;
}

function projectPrivateCapacityRow(row,hasNear,nearLat,nearLng){
  const recurring=(row.recurring_corridors||[]).slice(0,1).map(signal=>({
    ...signal,geometry:signal.geometry==='RADIUS'?'RADIUS':'ROUTE',
    route_points:validPlacePoints(signal.route_points,signal.geometry==='RADIUS'?0:2),
    area_boundary:validPlacePoints(signal.area_boundary,signal.geometry==='RADIUS'?3:0)
  }));
  const nearCenterDistance=hasNear&&Number.isFinite(Number(row.location_lat))&&Number.isFinite(Number(row.location_lng))
    ?distanceBetweenKm({lat:nearLat,lng:nearLng},{lat:Number(row.location_lat),lng:Number(row.location_lng)}):null;
  const distance=nearCenterDistance==null?null
    :possibleDistanceRange(nearCenterDistance,Number(row.location_precision_km||20),BUSINESS_SEARCH_PRIVACY_KM);
  const capacityAge=capacityUpdatePresentation(row.updated_at);
  const locationAge=capacityUpdatePresentation(row.location_updated_at,{kind:'location'});
  const driverKind=row.provider_kind==='FLEET_TRANSPORTER'?'COMPANY_DRIVER':row.provider_kind;
  return {...row,provider_kind:undefined,driver_documents:undefined,vehicle_documents:undefined,authorization_documents:undefined,
    recurring_corridors:recurring,current_route_points:validPlacePoints(row.current_route_points,row.availability_geometry==='ROUTE'?2:0),
    capacity_area_boundary:validPlacePoints(row.capacity_area_boundary,row.availability_geometry==='RADIUS'?3:0),
    driver_kind:driverKind,driver_kind_label:providerKindLabel(row.provider_kind),
    driver_verification_badges:verificationBadges(row.provider_kind==='FLEET_TRANSPORTER'?'DRIVER':'PROVIDER_PROFILE',row.driver_documents),
    truck_verification_badges:row.provider_kind==='OWNER_OPERATOR'
      ?verificationBadges('VEHICLE',row.vehicle_documents)
      :[truckAuthorizationBadge(row.authorization_documents,row.vehicle_id,row.platform_number)],
    possible_distance_min_km:distance?.minKm??null,possible_distance_max_km:distance?.maxKm??null,
    updated_label:publicBoardTime(row.updated_at),capacity_update_stage:capacityAge.stage,
    capacity_updated_label:capacityAge.label,capacity_confirmation_needed:capacityAge.confirmAvailability,
    location_update_stage:locationAge.stage,location_updated_label:locationAge.label,
    location_is_last_reported:locationAge.lastReported,
    accepts_full_load:Boolean(row.accepts_full_load),accepts_partial_load:Boolean(row.accepts_partial_load),
    accepts_multi_pick:Boolean(row.accepts_multi_pick),accepts_multi_drop:Boolean(row.accepts_multi_drop),
    current_signal_geometry_visible:true,near_center_distance_km:nearCenterDistance};
}

export async function listSupabaseSharedCapacity(emailDigest,filters={},options={}){
  return listSupabasePrivateCapacityProjection('EMAIL',emailDigest,null,filters,options);
}

export async function listSupabaseLoadgisticSharedCapacity(user,filters={},options={}){
  return listSupabasePrivateCapacityProjection('LOADGISTIC',privateContactDigest('loadgistic-platform'),user.id,filters,options);
}

async function listSupabasePrivateCapacityProjection(audience,emailDigest,actorUserId,filters,options){
  const client=createSupabaseAdminClient();
  const [originPlace,destinationPlace,areaPlace]=await Promise.all([
    resolveSupabasePlace(client,filters.originPlaceRef,filters.origin),
    resolveSupabasePlace(client,filters.destinationPlaceRef,filters.destination),
    resolveSupabasePlace(client,filters.currentAreaPlaceRef,filters.currentArea)
  ]);
  const nearLat=Number(filters.nearLat),nearLng=Number(filters.nearLng);
  const hasNear=Number.isFinite(nearLat)&&nearLat>=3&&nearLat<=15&&Number.isFinite(nearLng)&&nearLng>=32&&nearLng<=49;
  const hasGeographicFilter=Boolean(originPlace||destinationPlace||areaPlace);
  const nearRadius=[5,10,20,50,100].includes(Number(filters.nearRadiusKm))?Number(filters.nearRadiusKm):20;
  const pageSize=Math.max(12,Math.min(100,Number(options.pageSize)||100));
  const databasePageSize=100,maxScanPages=10;
  let databaseCursor=decodePublicCursor(options.cursor),databaseHasMore=true,scanPages=0;
  const matches=[];
  while(databaseHasMore&&matches.length<=pageSize&&scanPages<maxScanPages){
    const {data,error}=await client.rpc('private_capacity_projection',{
      requested_audience:audience,requested_digest:emailDigest,actor_user_id:actorUserId,
      cursor_updated_at:databaseCursor?.updatedAt||null,cursor_id:databaseCursor?.id||null,
      requested_page_size:databasePageSize
    });
    if(error)throw managedCapacityError('SUPABASE_PRIVATE_CAPACITY_PROJECTION_FAILED',error);
    const rawRows=(data||[]).map(row=>row.payload||row);
    databaseHasMore=rawRows.length>databasePageSize;
    const candidates=rawRows.slice(0,databasePageSize);
    let consumed=0;
    for(const row of candidates){
      consumed+=1;
      const item=projectPrivateCapacityRow(row,hasNear,nearLat,nearLng);
      if(!sharedCapacityBasicMatch(item,filters))continue;
      if(hasNear&&(item.near_center_distance_km==null
        ||item.near_center_distance_km>nearRadius+Number(item.location_precision_km||20)+BUSINESS_SEARCH_PRIVACY_KM))continue;
      const projected={...item,geographic_match_label:geographicMatchLabel(item,filters,originPlace,destinationPlace,areaPlace)};
      if(hasGeographicFilter&&!projected.geographic_match_label)continue;
      matches.push(projected);
      if(matches.length>pageSize)break;
    }
    const lastConsumed=candidates[consumed-1];
    if(lastConsumed)databaseCursor={updatedAt:lastConsumed.updated_at,id:lastConsumed.id};
    if(candidates.length<databasePageSize)databaseHasMore=false;
    scanPages+=1;
  }
  const selected=matches.slice(0,pageSize);
  const scanLimitReached=databaseHasMore&&scanPages>=maxScanPages&&matches.length<=pageSize;
  const hasMore=matches.length>pageSize||scanLimitReached;
  const nextCursor=matches.length>pageSize
    ?encodePublicCursor(selected.at(-1))
    :scanLimitReached&&databaseCursor
      ?encodePublicCursor({updated_at:databaseCursor.updatedAt,id:databaseCursor.id})
      :null;
  return {items:selected,nextCursor,hasMore,pageSize};
}

export async function listSupabasePendingAccessEmailDeliveries(limit=20){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('pending_access_email_deliveries',{requested_limit:Math.max(1,Math.min(100,Number(limit)||20))});
  if(error)throw managedCapacityError('SUPABASE_ACCESS_EMAIL_QUEUE_FAILED',error);
  return (data||[]).map(row=>row.payload||row);
}

export async function recordSupabaseAccessEmailDeliveryAttempt(id,{sent,error}={}){
  const client=createSupabaseAdminClient();
  const {error:queryError}=await client.rpc('record_access_email_delivery_attempt',{
    delivery_id:id,was_sent:Boolean(sent),failure_message:sent?null:String(error||'DELIVERY_FAILED').slice(0,500)
  });
  if(queryError)throw managedCapacityError('SUPABASE_ACCESS_EMAIL_RECORD_FAILED',queryError);
}

function seededTransporterPortraitUrl(filename){
  const value=String(filename||'');
  return /^[a-z0-9-]+\.png$/.test(value)?`/marketing/transporters/${value}`:null;
}

async function findPublicProviderOwner(client,handle){
  const normalized=String(handle||'').trim().toLowerCase();
  if(!normalized)return null;
  const [organizationResult,profileResult]=await Promise.all([
    client.from('organizations').select('id,name,handle,city,type').eq('handle',normalized).eq('type','TRANSPORT_COMPANY').maybeSingle(),
    client.from('provider_profiles').select('id,user_id,business_name,handle,city').eq('handle',normalized).maybeSingle()
  ]);
  if(organizationResult.error||profileResult.error)throw new Error('SUPABASE_PUBLIC_PROVIDER_LOOKUP_FAILED',{cause:organizationResult.error||profileResult.error});
  if(organizationResult.data)return {kind:'ORGANIZATION',id:organizationResult.data.id,organization:organizationResult.data,profile:null};
  if(profileResult.data)return {kind:'PROVIDER_PROFILE',id:profileResult.data.id,organization:null,profile:profileResult.data};
  return null;
}

export async function getSupabasePublicProviderProfileImage(handle){
  const client=createSupabaseAdminClient();
  const owner=await findPublicProviderOwner(client,handle);
  if(!owner)return null;
  const ownerColumn=owner.kind==='ORGANIZATION'?'organization_id':'provider_profile_id';
  const {data,error}=await client.from('company_pages')
    .select('profile_image_path,profile_image_mime,profile_image_updated_at,published')
    .eq(ownerColumn,owner.id).eq('published',true).not('profile_image_path','is',null).maybeSingle();
  if(error)throw new Error('SUPABASE_PUBLIC_PROVIDER_IMAGE_FAILED',{cause:error});
  return data?{file_path:data.profile_image_path,mime_type:data.profile_image_mime,profile_image_updated_at:data.profile_image_updated_at}:null;
}

export async function getSupabasePublicProvider(handle){
  const client=createSupabaseAdminClient();
  const owner=await findPublicProviderOwner(client,handle);
  if(!owner)return null;
  const ownerColumn=owner.kind==='ORGANIZATION'?'organization_id':'provider_profile_id';
  const capacityFilter=owner.kind==='ORGANIZATION'?{providerOrganizationId:owner.id}:{providerProfileId:owner.id};
  const reviewOwner=owner.kind==='ORGANIZATION'
    ?{requested_organization_id:owner.id,requested_provider_profile_id:null}
    :{requested_organization_id:null,requested_provider_profile_id:owner.id};
  const reviewOwnerColumn=owner.kind==='ORGANIZATION'?'provider_organization_id':'provider_profile_id';
  const [pageResult,vehicleResult,reviewResult,reviewSummaryResult,providerVerificationResult]=await Promise.all([
    client.from('company_pages').select('headline,about,services,theme_primary,theme_accent,contact_phone,contact_email,contact_whatsapp,contact_website,show_contact_phone,show_contact_whatsapp,show_contact_email,show_contact_website,youtube_video_id,profile_image_path,profile_image_updated_at,profile_image_preset,published')
      .eq(ownerColumn,owner.id).eq('published',true).maybeSingle(),
    client.from('vehicles').select('id,platform_number,make,model,category,cargo_configuration').eq(ownerColumn,owner.id).eq('active',true).order('platform_number'),
    client.from('provider_reviews').select('id,rating,note,created_at,dispute_status').eq(reviewOwnerColumn,owner.id).eq('status','PUBLISHED').order('created_at',{ascending:false}).limit(20),
    client.rpc('public_provider_review_summary',reviewOwner),
    client.from('verification_requests').select('subject_type,subject_id,verification_type,reviewed_at,expires_on,related_vehicle_id')
      .eq('subject_type',owner.kind).eq('subject_id',owner.id).eq('status','APPROVED')
      .order('reviewed_at',{ascending:false,nullsFirst:false})
  ]);
  const initialError=pageResult.error||vehicleResult.error||reviewResult.error||reviewSummaryResult.error||providerVerificationResult.error;
  if(initialError)throw new Error('SUPABASE_PUBLIC_PROVIDER_FAILED',{cause:initialError});
  const page=pageResult.data;
  if(!page)return null;
  const vehicles=vehicleResult.data||[];
  const vehicleIds=vehicles.map(vehicle=>vehicle.id);
  const profileUserId=owner.profile?.user_id||null;
  const [assignmentResult,vehicleDocumentResult,authorizationDocumentResult,profileUserResult]=await Promise.all([
    vehicleIds.length?client.from('driver_vehicle_assignments').select('vehicle_id,driver_user_id').in('vehicle_id',vehicleIds).eq('active',true):Promise.resolve({data:[],error:null}),
    vehicleIds.length?client.from('verification_requests').select('subject_type,subject_id,verification_type,reviewed_at,expires_on,related_vehicle_id')
      .eq('subject_type','VEHICLE').in('subject_id',vehicleIds).eq('status','APPROVED')
      .order('reviewed_at',{ascending:false,nullsFirst:false}):Promise.resolve({data:[],error:null}),
    vehicleIds.length?client.from('verification_requests').select('subject_type,subject_id,verification_type,reviewed_at,expires_on,related_vehicle_id')
      .eq('verification_type','VEHICLE_AUTHORIZATION').in('related_vehicle_id',vehicleIds).eq('status','APPROVED')
      .order('reviewed_at',{ascending:false,nullsFirst:false}):Promise.resolve({data:[],error:null}),
    profileUserId?client.from('profiles').select('id,full_name').eq('id',profileUserId).maybeSingle():Promise.resolve({data:null,error:null})
  ]);
  const secondaryError=assignmentResult.error||vehicleDocumentResult.error||authorizationDocumentResult.error||profileUserResult.error;
  if(secondaryError)throw new Error('SUPABASE_PUBLIC_PROVIDER_DETAIL_FAILED',{cause:secondaryError});
  const assignments=assignmentResult.data||[];
  const driverIds=[...new Set([
    ...assignments.map(assignment=>assignment.driver_user_id).filter(Boolean),
    ...(owner.kind==='PROVIDER_PROFILE'&&profileUserId?[profileUserId]:[])
  ])];
  const [driverProfileResult,driverRecordResult,driverDocumentResult]=await Promise.all([
    driverIds.length?client.from('profiles').select('id,full_name').in('id',driverIds):Promise.resolve({data:[],error:null}),
    driverIds.length?client.from('drivers').select('user_id,phone').in('user_id',driverIds).eq('active',true):Promise.resolve({data:[],error:null}),
    driverIds.length?client.from('verification_requests').select('subject_type,subject_id,verification_type,reviewed_at,expires_on,related_vehicle_id')
      .eq('subject_type','DRIVER').in('subject_id',driverIds).eq('status','APPROVED')
      .order('reviewed_at',{ascending:false,nullsFirst:false}):Promise.resolve({data:[],error:null})
  ]);
  const driverError=driverProfileResult.error||driverRecordResult.error||driverDocumentResult.error;
  if(driverError)throw new Error('SUPABASE_PUBLIC_PROVIDER_DRIVER_FAILED',{cause:driverError});
  const allDocuments=[...(providerVerificationResult.data||[]),...(vehicleDocumentResult.data||[]),
    ...(authorizationDocumentResult.data||[]),...(driverDocumentResult.data||[])];
  const documentsFor=(subjectType,subjectId)=>allDocuments.filter(record=>record.subject_type===subjectType&&record.subject_id===subjectId);
  const assignmentByVehicle=new Map(assignments.map(assignment=>[assignment.vehicle_id,assignment.driver_user_id]));
  const driverNameById=new Map((driverProfileResult.data||[]).map(driver=>[driver.id,driver.full_name]));
  const driverPhoneById=new Map((driverRecordResult.data||[]).map(driver=>[driver.user_id,driver.phone]));
  const ownershipExists=vehicles.some(vehicle=>documentsFor('VEHICLE',vehicle.id).some(record=>record.verification_type==='VEHICLE_OWNERSHIP'&&(!record.expires_on||record.expires_on>=ethiopiaDate())));
  const providerKind=owner.kind==='ORGANIZATION'?'FLEET_TRANSPORTER':ownershipExists?'OWNER_OPERATOR':'SELF_MANAGED_DRIVER';
  const capacities=[];let cursor=null;
  do{
    const capacityPage=await listSupabasePublicCapacityCursor(capacityFilter,{pageSize:16,cursor});
    capacities.push(...capacityPage.items);
    cursor=capacityPage.hasMore&&capacities.length<96?capacityPage.nextCursor:null;
  }while(cursor);
  const capacityByVehicle=new Map(capacities.map(capacity=>[capacity.vehicle_id,capacity]));
  const publicContactPhone=page.show_contact_phone?page.contact_phone:null;
  const trucks=vehicles.map(vehicle=>{
    const capacity=capacityByVehicle.get(vehicle.id)||null;
    if(capacity){
      const {vehicle_id:unusedVehicle,provider_organization_id:unusedOrganization,provider_profile_id:unusedProfile,...safeCapacity}=capacity;
      return {platform_number:vehicle.platform_number,make:vehicle.make,model:vehicle.model,
        cargo_configuration:vehicle.cargo_configuration||vehicle.category,
        assigned_driver_first_name:safeCapacity.assigned_driver_first_name,
        assigned_driver_phone:safeCapacity.assigned_driver_phone,
        driver_kind:safeCapacity.driver_kind,driver_kind_label:safeCapacity.driver_kind_label,
        driver_verification_badges:safeCapacity.driver_verification_badges,
        truck_verification_badges:safeCapacity.truck_verification_badges,capacity:safeCapacity};
    }
    const driverId=owner.kind==='ORGANIZATION'?assignmentByVehicle.get(vehicle.id):profileUserId;
    const subjectType=owner.kind==='ORGANIZATION'?'DRIVER':'PROVIDER_PROFILE';
    const subjectId=owner.kind==='ORGANIZATION'?driverId:owner.id;
    const driverName=owner.kind==='ORGANIZATION'?driverNameById.get(driverId):profileUserResult.data?.full_name;
    const driverKind=owner.kind==='ORGANIZATION'?'COMPANY_DRIVER':providerKind;
    return {platform_number:vehicle.platform_number,make:vehicle.make,model:vehicle.model,
      cargo_configuration:vehicle.cargo_configuration||vehicle.category,
      assigned_driver_first_name:String(driverName||'').trim().split(/\s+/)[0]||null,
      assigned_driver_phone:(owner.kind==='ORGANIZATION'?driverPhoneById.get(driverId):null)||publicContactPhone,
      driver_kind:driverKind,driver_kind_label:providerKindLabel(providerKind),
      driver_verification_badges:subjectId?verificationBadges(subjectType,documentsFor(subjectType,subjectId)):verificationBadges('DRIVER',[]),
      truck_verification_badges:providerKind==='OWNER_OPERATOR'?verificationBadges('VEHICLE',documentsFor('VEHICLE',vehicle.id))
        :[truckAuthorizationBadge(documentsFor(subjectType,subjectId),vehicle.id,vehicle.platform_number)],capacity:null};
  });
  const reviews=reviewResult.data||[];
  const reviewSummary=reviewSummaryResult.data||{};
  const providerBadges=verificationBadges(owner.kind,providerVerificationResult.data||[]);
  if(owner.kind==='PROVIDER_PROFILE'){
    const evidenceCandidates=vehicles.map(vehicle=>providerKind==='OWNER_OPERATOR'
      ?verificationBadges('VEHICLE',documentsFor('VEHICLE',vehicle.id))[0]
      :truckAuthorizationBadge([
        ...documentsFor('PROVIDER_PROFILE',owner.id),
        ...documentsFor('DRIVER',profileUserId)
      ],vehicle.id,vehicle.platform_number));
    const evidence=evidenceCandidates.find(badge=>badge?.verified)||evidenceCandidates.find(badge=>badge?.expired)||evidenceCandidates[0];
    if(evidence)providerBadges.push(evidence);
  }
  const providerName=owner.organization?.name||owner.profile?.business_name;
  const providerHandle=owner.organization?.handle||owner.profile?.handle;
  return {name:providerName,handle:providerHandle,headline:page.headline,about:page.about,services:page.services,
    city:owner.organization?.city||owner.profile?.city,theme_primary:page.theme_primary,theme_accent:page.theme_accent,
    youtube_video_id:page.youtube_video_id,contact_phone:publicContactPhone,
    contact_whatsapp:page.show_contact_whatsapp?page.contact_whatsapp:null,
    contact_email:page.show_contact_email?page.contact_email:null,
    contact_website:page.show_contact_website?page.contact_website:null,
    provider_organization_id:owner.organization?.id||null,provider_profile_id:owner.profile?.id||null,
    profile_image_url:page.profile_image_path?`/api/public/providers/${encodeURIComponent(providerHandle)}/image?v=${encodeURIComponent(page.profile_image_updated_at||'1')}`:seededTransporterPortraitUrl(page.profile_image_preset),
    provider_kind:providerKind,provider_kind_label:providerKind==='FLEET_TRANSPORTER'?'Fleet transporter':providerKindLabel(providerKind),
    vehicles:trucks.map(({capacity:unusedCapacity,...vehicle})=>vehicle),trucks,capacities,reviews,
    verification_badges:providerBadges,review_count:Number(reviewSummary.review_count||0),
    average_rating:reviewSummary.average_rating==null?null:Number(reviewSummary.average_rating)};
}

function featuredScheduleValue(value,fallback){
  if(value&&typeof value==='object')return value;
  try{return JSON.parse(String(value||''));}catch{return fallback;}
}

function featuredSchedule(day,featureDate,keys,keyAliases){
  const mode=String(day?.schedule_mode||'AUTO').toUpperCase();
  const config=featuredScheduleValue(day?.schedule_config_json,{});
  let manualSchedule=featuredScheduleValue(day?.manual_schedule_json,[]);
  if(mode==='MANUAL'){
    const allowed=new Set(keys);
    manualSchedule=(Array.isArray(manualSchedule)?manualSchedule:[]).map(item=>({
      ...item,providerKey:keyAliases.get(String(item?.providerKey||''))||String(item?.providerKey||'')
    })).filter(item=>allowed.has(item.providerKey));
  }
  try{return buildFeaturedDaySchedule(featureDate,keys,{mode,config,manualSchedule});}
  catch(error){
    if(mode==='MANUAL')return buildFeaturedDaySchedule(featureDate,keys,{mode:'AUTO',config});
    throw error;
  }
}

function assignFeaturedSponsors(schedule,sponsors){
  const names=sponsors.map(sponsor=>sponsor.name).filter(Boolean);
  let index=0;
  return {...schedule,entries:schedule.entries.map(entry=>{
    if(entry.type!=='SPONSOR_BREAK'||!names.length)return entry;
    const name=names[index%names.length];index+=1;
    return {...entry,sponsor_name:name,label:`Sponsor · ${name}`};
  })};
}

function featuredPortraitUrl(candidate){
  return candidate.has_profile_image
    ?`/api/public/providers/${encodeURIComponent(candidate.handle)}/image?v=${encodeURIComponent(candidate.profile_image_updated_at||'1')}`
    :seededTransporterPortraitUrl(candidate.profile_image_preset);
}

function decorateFeaturedCandidate(candidate){
  const signal=candidate.regular_signal;
  const corridor=signal?.geometry==='RADIUS'
    ?[signal.area_center_label,...(signal.area_boundary||[]).map(point=>point.label)].filter(Boolean).join(' · ')
    :(signal?.route_points||[]).map(point=>point.label).filter(Boolean).join('–');
  return {...candidate,profile_image_url:featuredPortraitUrl(candidate),base_region:providerRegionLabel(candidate.base_region_code),
    provider_kind_label:candidate.provider_kind==='FLEET_TRANSPORTER'?'Fleet transporter':providerKindLabel(candidate.provider_kind),
    corridors:corridor?[corridor]:[]};
}

export async function getSupabaseDailyFeaturedProviders(date=ethiopiaDate()){
  const featureDate=String(date||'');
  const expo=regionalExpoGroupForDate(featureDate);
  const client=createSupabaseAdminClient();
  const [dayResult,candidateResult]=await Promise.all([
    client.from('featured_provider_days').select('id,feature_date,expo_group_key,public_headline,public_introduction,tiktok_url,schedule_mode,schedule_config_json,manual_schedule_json,status')
      .eq('feature_date',featureDate).eq('status','PUBLISHED').maybeSingle(),
    client.rpc('public_featured_provider_candidates',{requested_region_codes:expo.regionCodes})
  ]);
  if(dayResult.error||candidateResult.error)throw new Error('SUPABASE_PUBLIC_FEATURED_FAILED',{cause:dayResult.error||candidateResult.error});
  const day=dayResult.data;
  const empty=()=>({feature_date:featureDate,base_place:expo.title,expo_group:expo,week:regionalExpoWeekForDate(featureDate),
    headline:'Daily Featured Transporters',introduction:`Today’s ${expo.title} transporter roster is being prepared.`,
    tiktok_url:null,broadcast_start_time:DEFAULT_FEATURED_SCHEDULE_CONFIG.dayStart,
    broadcast_end_time:DEFAULT_FEATURED_SCHEDULE_CONFIG.dayEnd,schedule:buildFeaturedDaySchedule(featureDate,0),
    walkthroughs:[],sponsored_providers:[],providers:[],published:false});
  if(!day||day.expo_group_key!==expo.key)return empty();
  const candidates=(candidateResult.data||[]).map(row=>decorateFeaturedCandidate(row.payload||row));
  const candidateByKey=new Map(candidates.map(candidate=>[
    candidate.provider_organization_id?`organization:${candidate.provider_organization_id}`:`profile:${candidate.provider_profile_id}`,candidate
  ]));
  const {data:slots,error:slotError}=await client.from('featured_provider_slots')
    .select('slot_position,provider_organization_id,provider_profile_id').eq('day_id',day.id).order('slot_position');
  if(slotError)throw new Error('SUPABASE_PUBLIC_FEATURED_SLOTS_FAILED',{cause:slotError});
  const providers=[];const providerKeys=[];const aliases=new Map();
  for(const slot of slots||[]){
    const key=slot.provider_organization_id?`organization:${slot.provider_organization_id}`:`profile:${slot.provider_profile_id}`;
    const candidate=candidateByKey.get(key);
    if(!candidate?.eligible)continue;
    const {provider_organization_id:unusedOrganization,provider_profile_id:unusedProfile,eligible:unusedEligibility,
      base_region_code:unusedRegion,has_profile_image:unusedImage,profile_image_preset:unusedPreset,
      profile_image_updated_at:unusedImageUpdated,regular_signal:unusedSignal,...safe}=candidate;
    providers.push({...safe,position:slot.slot_position});providerKeys.push(candidate.handle);aliases.set(key,candidate.handle);
  }
  const {data:placements,error:placementError}=await client.from('sponsor_placements')
    .select('sponsor_id,position').eq('expo_group_key',expo.key).eq('active',true)
    .lte('starts_on',featureDate).gte('ends_on',featureDate).order('position').limit(5);
  if(placementError)throw new Error('SUPABASE_PUBLIC_SPONSORS_FAILED',{cause:placementError});
  const sponsorIds=(placements||[]).map(placement=>placement.sponsor_id);
  const sponsorResult=sponsorIds.length?await client.from('sponsors')
    .select('id,sponsor_kind,provider_organization_id,provider_profile_id,business_name,description,website_url,phone')
    .in('id',sponsorIds).eq('active',true):{data:[],error:null};
  if(sponsorResult.error)throw new Error('SUPABASE_PUBLIC_SPONSORS_FAILED',{cause:sponsorResult.error});
  const sponsorById=new Map((sponsorResult.data||[]).map(sponsor=>[sponsor.id,sponsor]));
  const sponsoredProviders=[];
  for(const placement of placements||[]){
    const sponsor=sponsorById.get(placement.sponsor_id);if(!sponsor)continue;
    if(sponsor.sponsor_kind==='ADVERTISER'){
      sponsoredProviders.push({sponsor_kind:'ADVERTISER',name:sponsor.business_name,description:sponsor.description,
        website_url:sponsor.website_url||null,phone:sponsor.phone||null,sponsor_position:placement.position,sponsored:true});
      continue;
    }
    const key=sponsor.provider_organization_id?`organization:${sponsor.provider_organization_id}`:`profile:${sponsor.provider_profile_id}`;
    const candidate=candidateByKey.get(key);if(!candidate?.eligible)continue;
    const {provider_organization_id:unusedOrganization,provider_profile_id:unusedProfile,eligible:unusedEligibility,
      base_region_code:unusedRegion,has_profile_image:unusedImage,profile_image_preset:unusedPreset,
      profile_image_updated_at:unusedImageUpdated,regular_signal:unusedSignal,...safe}=candidate;
    sponsoredProviders.push({...safe,sponsor_kind:'TRANSPORTER',sponsor_position:placement.position,sponsored:true});
  }
  const schedule=assignFeaturedSponsors(featuredSchedule(day,featureDate,providerKeys,aliases),sponsoredProviders);
  return {feature_date:featureDate,base_place:expo.title,expo_group:expo,week:regionalExpoWeekForDate(featureDate),
    headline:day.public_headline||'Daily Featured Transporters',
    introduction:day.public_introduction||`Meet transporters based in ${expo.title}, then find their current trucks in the Truck Market.`,
    tiktok_url:day.tiktok_url,broadcast_start_time:schedule.config.dayStart,broadcast_end_time:schedule.config.dayEnd,
    schedule,walkthroughs:schedule.walkthroughs,sponsored_providers:sponsoredProviders,providers,published:true};
}
