import {verificationBadgesFromApproved,truckDocumentBadges} from '../verification-summary.js';
import {capacityDatabaseFilters} from '../capacity-viewport.js';
import {loadPublicProviderFleet,publicFleetVehicleIds} from '../public-provider-paging.js';
import { createSupabaseAdminClient } from '../supabase-adapter.js';
import {BUSINESS_SEARCH_PRIVACY_KM,possibleDistanceRange} from '../location-privacy.js';
import {resolveCapacityFilterPlaces} from '../capacity-filter-places.js';
import {capacityGeographicMatch} from '../capacity-geographic-match.js';
import {buildFeaturedDaySchedule,DEFAULT_FEATURED_SCHEDULE_CONFIG} from '../expo-broadcast.js';
import {PROVIDER_REGIONS,providerRegionLabel,regionalExpoGroupForDate,regionalExpoWeekForDate} from '../provider-regions.js';
import {FEATURED_PROVIDER_DAY} from '../featured-trucks.js';
import {readFeaturedRows} from '../featured-truck-candidates.js';
import {capacityUpdatePresentation,distanceBetweenKm} from '../domain.js';

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

function verificationBadges(subjectType,records){return verificationBadgesFromApproved(subjectType,records);}

async function capacityOwnerBadges(client,rows){
  const organizationIds=[...new Set(rows.map(row=>row.provider_organization_id).filter(Boolean))];
  const providerIds=[...new Set(rows.map(row=>row.provider_profile_id).filter(Boolean))];
  if(!rows.length)return new Map();
  const {data,error}=await client.rpc('capacity_owner_documents',{organization_ids:organizationIds,provider_ids:providerIds});
  if(error)throw new Error('SUPABASE_CAPACITY_OWNER_DOCUMENTS_FAILED',{cause:error});
  return new Map((data||[]).map(owner=>[owner.subject_id,verificationBadges(owner.subject_type,owner.documents)]));
}

export async function listSupabasePublicCapacityCursor(filters={},options={}){
  const client=createSupabaseAdminClient();
  const pageSize=Math.max(12,Math.min(16,Number(options.pageSize)||14));
  const cursor=decodePublicCursor(options.cursor);
  const resolved=await resolveCapacityFilterPlaces(client,filters);
  if(resolved.filterError)return {items:[],hasMore:false,nextCursor:null,pageSize:pageSize,filterError:resolved.filterError};
  const [originPlace,destinationPlace,areaPlace,truckCity]=resolved.places;
  const nearLat=truckCity?.center_lat??Number(filters.nearLat),nearLng=truckCity?.center_lng??Number(filters.nearLng);
  let query;
  try{query={...capacityDatabaseFilters(filters,resolved.places),
    ...(filters.vehicleIds!==undefined?{vehicle_ids:publicFleetVehicleIds(filters.vehicleIds)}:{}),
    provider_organization_id:filters.providerOrganizationId||null,provider_profile_id:filters.providerProfileId||null};}
  catch{return {items:[],hasMore:false,nextCursor:null,pageSize,filterError:'Map bounds are invalid. Move the map and try again.'};}
  const hasNear=query.near_lat!==null&&query.near_lng!==null;
  if(options.overview&&query.viewport){
    const {data,error}=await client.rpc('public_capacity_clusters',{query});
    if(error)throw new Error('SUPABASE_PUBLIC_CAPACITY_FAILED',{cause:error});
    return {items:[],clusters:(data||[]).map(row=>row.payload||row),nextCursor:null,hasMore:false,pageSize};
  }
  const rows=[];
  let scanCursor=cursor,scanComplete=false,scanPages=0;
  while(rows.length<=pageSize&&!scanComplete&&scanPages<25){
    const {data,error}=await client.rpc('public_capacity_page',{
      query,cursor_updated_at:scanCursor?.updatedAt||null,cursor_id:scanCursor?.id||null,requested_page_size:pageSize
    });
    if(error)throw new Error('SUPABASE_PUBLIC_CAPACITY_FAILED',{cause:error});
    const batch=(data||[]).map(row=>row.payload||row);
    rows.push(...batch.filter(row=>row.current_signal_geometry_visible!==false));
    scanPages+=1;
    scanComplete=batch.length<=pageSize;
    const tail=batch.at(-1);
    if(!scanComplete&&tail)scanCursor={updatedAt:tail.updated_at,id:tail.id};
    else if(!tail)scanComplete=true;
  }
  const hasMore=rows.length>pageSize;
  const selected=rows.slice(0,pageSize);
  const ownerBadges=await capacityOwnerBadges(client,selected);
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
      driver_kind:driverKind,driver_kind_label:'Driver',
      owner_verification_badges:ownerBadges.get(row.provider_organization_id||row.provider_profile_id)||[],
      driver_verification_badges:verificationBadges('DRIVER',row.driver_documents),
      truck_verification_badges:truckDocumentBadges(row.vehicle_documents,row.authorization_documents,row.vehicle_id,row.platform_number),
      possible_distance_min_km:distance?.minKm??null,possible_distance_max_km:distance?.maxKm??null,
      near_center_distance_km:undefined,updated_label:publicBoardTime(row.updated_at),
      capacity_update_stage:capacityAge.stage,capacity_updated_label:capacityAge.label,
      capacity_confirmation_needed:capacityAge.confirmAvailability,
      location_update_stage:locationAge?.stage??null,location_updated_label:locationAge?.label??null,
      location_is_last_reported:locationAge?.lastReported??null,
      accepts_full_load:Boolean(row.accepts_full_load),accepts_partial_load:Boolean(row.accepts_partial_load),
      accepts_multi_pick:Boolean(row.accepts_multi_pick),accepts_multi_drop:Boolean(row.accepts_multi_drop)
    };
    return {...base,geographic_match_label:capacityGeographicMatch(base,filters,originPlace,destinationPlace,areaPlace).label};
  });
  return {items,nextCursor:hasMore?encodePublicCursor(selected.at(-1)):null,hasMore,pageSize};
}

function managedCapacityError(code,error){
  const message=String(error?.message||'');
  if(/NOT_FOUND/.test(message))return new Error('NOT_FOUND');
  if(/FORBIDDEN/.test(message))return new Error('FORBIDDEN');
  if(/EXCLUSIVE_RECIPIENT_ONLY/.test(message))return new Error('EXCLUSIVE_RECIPIENT_ONLY');
  if(/CONTACT_NAME_REQUIRED/.test(message))return new Error('CONTACT_NAME_REQUIRED');
  if(/INVALID_EMAIL/.test(message))return new Error('INVALID_EMAIL');
  return new Error(code,{cause:error});
}

export async function listSupabasePrivateCapacityNetwork(user){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('private_capacity_network',{actor_user_id:user.id});
  if(error)throw managedCapacityError('SUPABASE_PRIVATE_CAPACITY_NETWORK_FAILED',error);
  return (data||[]).map(row=>row.payload||row);
}

/** @returns {Promise<{id:string}>} */
export async function grantSupabasePrivateCapacityAccess(_user,_input){
  throw new Error('EMAIL_CAPACITY_RETIRED');
}

export async function nameSupabasePrivateCapacityContact(_user,_input){
  throw new Error('EMAIL_CAPACITY_RETIRED');
}

export async function setSupabaseLoadgisticCapacityAccess(){throw new Error('PLATFORM_CAPACITY_RETIRED');}

export async function revokeSupabasePrivateCapacityAccess(user,grantId){
  const client=createSupabaseAdminClient();
  const {error}=await client.rpc('revoke_private_capacity_access',{
    actor_user_id:user.id,target_grant_id:String(grantId||'')
  });
  if(error)throw managedCapacityError('SUPABASE_PRIVATE_CAPACITY_REVOKE_FAILED',error);
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
    driver_kind:driverKind,driver_kind_label:'Driver',
    driver_verification_badges:verificationBadges('DRIVER',row.driver_documents),
    truck_verification_badges:truckDocumentBadges(row.vehicle_documents,row.authorization_documents,row.vehicle_id,row.platform_number),
    possible_distance_min_km:distance?.minKm??null,possible_distance_max_km:distance?.maxKm??null,
    updated_label:publicBoardTime(row.updated_at),capacity_update_stage:capacityAge.stage,
    capacity_updated_label:capacityAge.label,capacity_confirmation_needed:capacityAge.confirmAvailability,
    location_update_stage:locationAge.stage,location_updated_label:locationAge.label,
    location_is_last_reported:locationAge.lastReported,
    accepts_full_load:Boolean(row.accepts_full_load),accepts_partial_load:Boolean(row.accepts_partial_load),
    accepts_multi_pick:Boolean(row.accepts_multi_pick),accepts_multi_drop:Boolean(row.accepts_multi_drop),
    current_signal_geometry_visible:true,near_center_distance_km:nearCenterDistance};
}

export async function listSupabaseAccountCapacity(actorId,emailDigest,filters={},options={}){
  if(!actorId||!emailDigest)throw new Error('ACCOUNT_CAPACITY_FORBIDDEN');
  return listSupabasePrivateCapacityProjection('ACCOUNT',emailDigest,actorId,filters,options);
}

export async function listSupabaseBusinessCapacity(actorId,workspaceId,filters={},options={}){
  return listSupabasePrivateCapacityProjection('BUSINESS',null,actorId,filters,options,workspaceId);
}

export async function listSupabaseLoadgisticSharedCapacity(){throw new Error('PLATFORM_CAPACITY_RETIRED');}

async function listSupabasePrivateCapacityProjection(audience,emailDigest,actorUserId,filters,options,businessWorkspaceId){
  const client=createSupabaseAdminClient();
  const resolved=await resolveCapacityFilterPlaces(client,filters);
  if(resolved.filterError)return {items:[],hasMore:false,nextCursor:null,pageSize:100,filterError:resolved.filterError};
  const [originPlace,destinationPlace,areaPlace,truckCity]=resolved.places;
  const nearLat=truckCity?.center_lat??Number(filters.nearLat),nearLng=truckCity?.center_lng??Number(filters.nearLng);
  const pageSize=Math.max(12,Math.min(100,Number(options.pageSize)||100));
  let query;
  try{query=capacityDatabaseFilters(filters,resolved.places);}
  catch{return {items:[],hasMore:false,nextCursor:null,pageSize,filterError:'Map bounds are invalid. Move the map and try again.'};}
  const hasNear=query.near_lat!==null&&query.near_lng!==null;
  const cursor=decodePublicCursor(options.cursor);
  const rpcName=businessWorkspaceId?'business_capacity_filtered_page':audience==='ACCOUNT'?'account_capacity_filtered_page':'private_capacity_filtered_page';
  const {data,error}=await client.rpc(rpcName,{
    ...(businessWorkspaceId?{target_workspace_id:businessWorkspaceId}:audience==='ACCOUNT'?{recipient_digest:emailDigest}:{requested_audience:audience,requested_digest:emailDigest}),actor_user_id:actorUserId,
    cursor_updated_at:cursor?.updatedAt||null,cursor_id:cursor?.id||null,requested_page_size:pageSize,query
  });
  if(error)throw managedCapacityError('SUPABASE_PRIVATE_CAPACITY_PROJECTION_FAILED',error);
  const rows=(data||[]).map(row=>row.payload||row);
  const selected=rows.slice(0,pageSize);
  const ownerBadges=await capacityOwnerBadges(client,selected);
  const items=selected.map(row=>{
    const item=projectPrivateCapacityRow(row,hasNear,nearLat,nearLng);
    return {...item,owner_verification_badges:ownerBadges.get(row.provider_organization_id||row.provider_profile_id)||[],geographic_match_label:capacityGeographicMatch(item,filters,originPlace,destinationPlace,areaPlace).label};
  });
  const hasMore=rows.length>pageSize;
  return {items,nextCursor:hasMore?encodePublicCursor(selected.at(-1)):null,hasMore,pageSize};
}

export async function listSupabasePendingAccessEmailDeliveries(limit=20){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('pending_access_email_deliveries',{requested_limit:Math.max(1,Math.min(100,Number(limit)||20))});
  if(error)throw managedCapacityError('SUPABASE_ACCESS_EMAIL_QUEUE_FAILED',error);
  return (data||[]).map(row=>row.payload||row);
}

export async function claimSupabaseAccessEmailDelivery(kind,entityId){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('claim_access_email_delivery',{
    requested_kind:String(kind||''),requested_entity_id:String(entityId||'')
  });
  if(error)throw managedCapacityError('SUPABASE_ACCESS_EMAIL_TARGET_FAILED',error);
  return data?.payload||data||null;
}

export async function recordSupabaseAccessEmailDeliveryAttempt(id,{leaseToken,sent,error}={}){
  const client=createSupabaseAdminClient();
  const {data,error:queryError}=await client.rpc('record_access_email_delivery_attempt',{
    delivery_id:id,claimed_lease_token:String(leaseToken||''),was_sent:Boolean(sent),
    failure_message:sent?null:String(error||'DELIVERY_FAILED').slice(0,500)
  });
  if(queryError)throw managedCapacityError('SUPABASE_ACCESS_EMAIL_RECORD_FAILED',queryError);
  return Boolean(data);
}

export async function isSupabaseAccessEmailDeliveryDeliverable(id,leaseToken){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('access_email_delivery_is_deliverable',{
    delivery_id:String(id||''),claimed_lease_token:String(leaseToken||'')
  });
  if(error)throw managedCapacityError('SUPABASE_ACCESS_EMAIL_DELIVERY_CHECK_FAILED',error);
  return Boolean(data);
}

export async function purgeSupabaseSharedCapacityAccess(limit=100){
  const client=createSupabaseAdminClient();
  const requestedLimit=Math.max(1,Math.min(500,Number(limit)||100));
  const [{data,error},{data:trackingData,error:trackingError}]=await Promise.all([
    client.rpc('shared_capacity_access_cleanup',{requested_limit:requestedLimit}),
    client.rpc('tracking_email_otp_cleanup',{requested_limit:requestedLimit})
  ]);
  if(error||trackingError)throw managedCapacityError('SUPABASE_SHARED_CAPACITY_CLEANUP_FAILED',error||trackingError);
  return {
    otpCount:Math.max(0,Number(data?.otpCount)||0),
    deliveryCount:Math.max(0,Number(data?.deliveryCount)||0),
    guestDeliveryCount:Math.max(0,Number(data?.guestDeliveryCount)||0),
    trackingOtpCount:Math.max(0,Number(trackingData?.otpCount)||0),
    trackingDeliveryCount:Math.max(0,Number(trackingData?.deliveryCount)||0)
  };
}

function seededTransporterPortraitUrl(filename){
  const value=String(filename||'');
  return /^[a-z0-9-]+\.png$/.test(value)?`/marketing/transporters/${value}`:null;
}

async function findPublicProviderOwner(client,handle,resolveAlias=true){
  const normalized=String(handle||'').trim().toLowerCase();
  if(!normalized)return null;
  const [organizationResult,profileResult]=await Promise.all([
    client.from('organizations').select('id,name,handle,city,type').eq('handle',normalized).eq('type','TRANSPORT_COMPANY').eq('public_visibility','PUBLIC').eq('content_hidden',false).eq('review_workspace',false).maybeSingle(),
    client.from('provider_profiles').select('id,user_id,handle').eq('handle',normalized).eq('public_visibility','PUBLIC').eq('content_hidden',false).eq('review_workspace',false).maybeSingle()
  ]);
  if(organizationResult.error||profileResult.error)throw new Error('SUPABASE_PUBLIC_PROVIDER_LOOKUP_FAILED',{cause:organizationResult.error||profileResult.error});
  if(organizationResult.data)return {kind:'ORGANIZATION',id:organizationResult.data.id,organization:organizationResult.data,profile:null};
  if(profileResult.data)return {kind:'PROVIDER_PROFILE',id:profileResult.data.id,organization:null,profile:profileResult.data};
  if(resolveAlias){const result=await client.rpc('resolve_public_provider_handle',{requested_handle:normalized});if(result.error)throw new Error('SUPABASE_PUBLIC_PROVIDER_LOOKUP_FAILED');if(result.data?.handle&&result.data.handle!==normalized)return findPublicProviderOwner(client,result.data.handle,false);}
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

export async function getSupabasePublicProvider(handle,options={}){
  const client=createSupabaseAdminClient();
  const owner=await findPublicProviderOwner(client,handle);
  if(!owner)return null;
  const capacityFilter=owner.kind==='ORGANIZATION'?{providerOrganizationId:owner.id}:{providerProfileId:owner.id};
  const reviewOwner=owner.kind==='ORGANIZATION'
    ?{requested_organization_id:owner.id,requested_provider_profile_id:null}
    :{requested_organization_id:null,requested_provider_profile_id:owner.id};
  const reviewOwnerColumn=owner.kind==='ORGANIZATION'?'provider_organization_id':'provider_profile_id';
  const [pageResult,vehicleResult,reviewResult,reviewSummaryResult,providerVerificationResult]=await Promise.all([
    client.rpc('public_provider_page_details',reviewOwner),
    loadPublicProviderFleet(client,owner,options.truckPage),
    client.from('provider_reviews').select('id,rating,note,created_at,dispute_status').eq(reviewOwnerColumn,owner.id).eq('status','PUBLISHED').order('created_at',{ascending:false}).limit(20),
    client.rpc('public_provider_review_summary',reviewOwner),
    client.from('verification_requests').select('subject_type,subject_id,verification_type,reviewed_at,expires_on,related_vehicle_id')
      .eq('subject_type',owner.kind).eq('subject_id',owner.id).eq('status','APPROVED')
      .order('reviewed_at',{ascending:false,nullsFirst:false})
  ]);
  const initialError=pageResult.error||reviewResult.error||reviewSummaryResult.error||providerVerificationResult.error;
  if(initialError)throw new Error('SUPABASE_PUBLIC_PROVIDER_FAILED',{cause:initialError});
  const page=pageResult.data;
  if(!page||!vehicleResult)return null;
  const vehicles=vehicleResult.items;
  const vehicleIds=vehicles.map(vehicle=>vehicle.id);
  const profileUserId=owner.profile?.user_id||null;
  const [vehicleDocumentResult,authorizationDocumentResult]=await Promise.all([
    vehicleIds.length?client.from('verification_requests').select('subject_type,subject_id,verification_type,reviewed_at,expires_on,related_vehicle_id')
      .eq('subject_type','VEHICLE').in('subject_id',vehicleIds).eq('status','APPROVED')
      .order('reviewed_at',{ascending:false,nullsFirst:false}):Promise.resolve({data:[],error:null}),
    vehicleIds.length?client.from('verification_requests').select('subject_type,subject_id,verification_type,reviewed_at,expires_on,related_vehicle_id')
      .eq('verification_type','VEHICLE_AUTHORIZATION').in('related_vehicle_id',vehicleIds).eq('status','APPROVED')
      .order('reviewed_at',{ascending:false,nullsFirst:false}):Promise.resolve({data:[],error:null})
  ]);
  const secondaryError=vehicleDocumentResult.error||authorizationDocumentResult.error;
  if(secondaryError)throw new Error('SUPABASE_PUBLIC_PROVIDER_DETAIL_FAILED',{cause:secondaryError});
  const driverIds=[...new Set(vehicles.map(vehicle=>vehicle.assigned_driver_id).filter(Boolean))];
  const [driverProfileResult,driverDocumentResult]=await Promise.all([
    driverIds.length?client.rpc('public_person_identities',{requested_user_ids:driverIds}):Promise.resolve({data:[],error:null}),
    driverIds.length?client.from('verification_requests').select('subject_type,subject_id,verification_type,reviewed_at,expires_on,related_vehicle_id')
      .eq('subject_type','DRIVER').in('subject_id',driverIds).eq('status','APPROVED')
      .order('reviewed_at',{ascending:false,nullsFirst:false}):Promise.resolve({data:[],error:null})
  ]);
  const driverError=driverProfileResult.error||driverDocumentResult.error;
  if(driverError)throw new Error('SUPABASE_PUBLIC_PROVIDER_DRIVER_FAILED',{cause:driverError});
  const allDocuments=[...(providerVerificationResult.data||[]),...(vehicleDocumentResult.data||[]),
    ...(authorizationDocumentResult.data||[]),...(driverDocumentResult.data||[])];
  const documentsFor=(subjectType,subjectId)=>allDocuments.filter(record=>record.subject_type===subjectType&&record.subject_id===subjectId);
  const driverNameById=new Map((driverProfileResult.data||[]).map(driver=>[driver.id,driver.first_name]));
  const driverPhoneById=new Map((driverProfileResult.data||[]).map(driver=>[driver.id,driver.callback_phone]));
  const driverPortraitById=new Map((driverProfileResult.data||[]).map(driver=>[driver.id,driver.portrait_url]));
  const providerKind=owner.kind==='ORGANIZATION'?'FLEET_TRANSPORTER':'SELF_MANAGED_DRIVER';
  const capacityPage=vehicleIds.length?await listSupabasePublicCapacityCursor({...capacityFilter,vehicleIds},{pageSize:12}):{items:[]};
  const capacities=capacityPage.items;
  const capacityByVehicle=new Map(capacities.map(capacity=>[capacity.vehicle_id,capacity]));
  const publicContactPhone=page.show_contact_phone?page.contact_phone:null;
  const trucks=vehicles.map(vehicle=>{
    const capacity=capacityByVehicle.get(vehicle.id)||null;
    if(capacity){
      const {vehicle_id:unusedVehicle,provider_organization_id:unusedOrganization,provider_profile_id:unusedProfile,...safeCapacity}=capacity;
      return {authority:vehicle.authority,platform_number:vehicle.platform_number,make:vehicle.make,model:vehicle.model,
        cargo_configuration:vehicle.cargo_configuration||vehicle.category,
        assigned_driver_first_name:safeCapacity.assigned_driver_first_name,
        assigned_driver_portrait_url:safeCapacity.assigned_driver_portrait_url,
        assigned_driver_phone:safeCapacity.assigned_driver_phone,
        driver_kind:safeCapacity.driver_kind,driver_kind_label:safeCapacity.driver_kind_label,
        driver_verification_badges:safeCapacity.driver_verification_badges,
        truck_verification_badges:safeCapacity.truck_verification_badges,capacity:safeCapacity};
    }
    const driverId=vehicle.assigned_driver_id;
    const isPersonalOwnerDriver=owner.kind==='PROVIDER_PROFILE'&&Boolean(driverId)&&driverId===profileUserId;
    const subjectType=isPersonalOwnerDriver?'PROVIDER_PROFILE':'DRIVER';
    const subjectId=isPersonalOwnerDriver?owner.id:driverId;
    const driverName=driverNameById.get(driverId);
    const driverKind=owner.kind==='ORGANIZATION'?'COMPANY_DRIVER':providerKind;
    return {authority:vehicle.authority,platform_number:vehicle.platform_number,make:vehicle.make,model:vehicle.model,
      cargo_configuration:vehicle.cargo_configuration||vehicle.category,
      assigned_driver_first_name:driverName||null,
      assigned_driver_portrait_url:driverPortraitById.get(driverId)||null,
      assigned_driver_phone:driverPhoneById.get(driverId)||null,
      driver_kind:driverKind,driver_kind_label:'Driver',
      driver_verification_badges:verificationBadges('DRIVER',subjectId?documentsFor(subjectType,subjectId):[]),
      truck_verification_badges:truckDocumentBadges(documentsFor('VEHICLE',vehicle.id),documentsFor(subjectType,subjectId),vehicle.id,vehicle.platform_number),capacity:null};
  });
  const reviews=reviewResult.data||[];
  const reviewSummary=reviewSummaryResult.data||{};
  const providerBadges=verificationBadges(owner.kind,providerVerificationResult.data||[]);
  const providerHandle=owner.organization?.handle||owner.profile?.handle;
  const providerName=page.account_name||page.public_name||owner.organization?.name||providerHandle;
  return {account_name:providerName,manager_name:page.manager_name||null,name:providerName,handle:providerHandle,headline:page.headline,about:page.about,services:'',
    city:owner.organization?.city||'',theme_primary:page.theme_primary,theme_accent:page.theme_accent,
    youtube_video_id:page.youtube_video_id,contact_phone:publicContactPhone,
    contact_whatsapp:page.show_contact_whatsapp?page.contact_whatsapp:null,
    contact_email:page.show_contact_email?page.contact_email:null,
    contact_website:page.show_contact_website?page.contact_website:null,
    provider_organization_id:owner.organization?.id||null,provider_profile_id:owner.profile?.id||null,
    profile_image_url:page.has_profile_image?`/api/public/providers/${encodeURIComponent(providerHandle)}/image?v=${encodeURIComponent(page.profile_image_updated_at||'1')}`:seededTransporterPortraitUrl(page.profile_image_preset),
    provider_kind:providerKind,provider_kind_label:'Transport Provider',authoritySummary:vehicleResult.authority_summary,
    fleet_page:{page:vehicleResult.page,pageCount:vehicleResult.page_count,total:vehicleResult.total,pageSize:vehicleResult.page_size},
    vehicles:trucks.map(({capacity:unusedCapacity,...vehicle})=>vehicle),trucks,capacities,reviews,
    regular_service:null,
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
  try{return buildFeaturedDaySchedule(featureDate,keys,{mode,config,manualSchedule,allowLegacyWindow:true});}
  catch(error){
    if(mode==='MANUAL')return buildFeaturedDaySchedule(featureDate,keys,{mode:'AUTO',config,allowLegacyWindow:true});
    throw error;
  }
}

function assignFeaturedSponsors(schedule,sponsors){
  const names=sponsors.map(sponsor=>sponsor.name).filter(Boolean);
  let index=0;
  return {...schedule,entries:schedule.entries.map(entry=>{
    if(entry.type!=='PROGRAMME_BREAK'||!names.length)return entry;
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
  return {...candidate,services:'',regular_signal:null,profile_image_url:featuredPortraitUrl(candidate),base_region:providerRegionLabel(candidate.base_region_code),
    provider_kind_label:'Transport Provider',
    corridors:[]};
}

export async function getSupabaseDailyFeaturedProviders(date=ethiopiaDate()){
  const featureDate=String(date||'');
  const expo=regionalExpoGroupForDate(featureDate);
  const client=createSupabaseAdminClient();
  const [dayResult,candidateRows]=await Promise.all([
    client.from('featured_provider_days').select('id,feature_date,expo_group_key,public_headline,public_introduction,tiktok_url,schedule_mode,schedule_config_json,manual_schedule_json,status')
      .eq('feature_date',featureDate).eq('status','PUBLISHED').maybeSingle(),
    readFeaturedRows(()=>client.rpc('public_featured_provider_candidates',{requested_region_codes:expo.regionCodes}),
      'SUPABASE_PUBLIC_FEATURED_FAILED')
  ]);
  if(dayResult.error)throw new Error('SUPABASE_PUBLIC_FEATURED_FAILED',{cause:dayResult.error});
  const day=dayResult.data;
  const empty=()=>({feature_date:featureDate,base_place:expo.title,expo_group:expo,week:regionalExpoWeekForDate(featureDate),
    headline:'Daily Featured Transporters',introduction:`Today’s ${expo.title} transporter roster is being prepared.`,
    tiktok_url:null,broadcast_start_time:DEFAULT_FEATURED_SCHEDULE_CONFIG.dayStart,
    broadcast_end_time:DEFAULT_FEATURED_SCHEDULE_CONFIG.dayEnd,schedule:buildFeaturedDaySchedule(featureDate,0),
    walkthroughs:[],sponsored_providers:[],providers:[],published:false});
  if(!day||day.expo_group_key!==expo.key)return empty();
  const candidates=candidateRows.map(row=>decorateFeaturedCandidate(row.payload||row));
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
    introduction:day.public_introduction||`Meet transporters based in ${expo.title}, then find their current vehicles in Open capacity.`,
    tiktok_url:day.tiktok_url,broadcast_start_time:schedule.config.dayStart,broadcast_end_time:schedule.config.dayEnd,
    schedule,walkthroughs:schedule.walkthroughs,sponsored_providers:sponsoredProviders,providers,published:true};
}

export async function getSupabaseDailyFeaturedTrucks(date=ethiopiaDate()){
  const featureDate=String(date||'');const theme=FEATURED_PROVIDER_DAY;const sponsorGroup=regionalExpoGroupForDate(featureDate);
  const client=createSupabaseAdminClient();
  const [dayResult,providerRows]=await Promise.all([
    client.from('featured_provider_days').select('id,feature_date,expo_group_key,public_headline,public_introduction,tiktok_url,tiktok_broadcast_status,schedule_mode,schedule_config_json,manual_schedule_json,target_count,status').eq('feature_date',featureDate).eq('status','PUBLISHED').maybeSingle(),
    readFeaturedRows(()=>client.rpc('public_featured_provider_candidates',{requested_region_codes:PROVIDER_REGIONS.map(region=>region.code)}),
      'SUPABASE_PUBLIC_FEATURED_FAILED')
  ]);
  if(dayResult.error)throw new Error('SUPABASE_PUBLIC_FEATURED_FAILED',{cause:dayResult.error});
  const providers=providerRows.map(row=>decorateFeaturedCandidate(row.payload||row));
  const providerByKey=new Map(providers.map(provider=>[provider.provider_organization_id?`organization:${provider.provider_organization_id}`:`profile:${provider.provider_profile_id}`,provider]));
  const empty=()=>({feature_date:featureDate,base_place:theme.label,expo_group:theme,week:[],theme,
    headline:'Daily Featured Transport Providers',introduction:'Meet the transport accounts in today’s showcase.',tiktok_url:null,
    broadcast_start_time:'08:30',broadcast_end_time:'12:00',tiktok_broadcast_status:'NOT_SCHEDULED',schedule:buildFeaturedDaySchedule(featureDate,0),walkthroughs:[],sponsored_providers:[],providers:[],published:false});
  const day=dayResult.data;if(!day)return empty();
  const {data:slots,error:slotError}=await client.from('featured_provider_slots').select('slot_position,provider_organization_id,provider_profile_id,vehicle_id,driver_user_id').eq('day_id',day.id).order('slot_position');
  if(slotError)throw new Error('SUPABASE_PUBLIC_FEATURED_SLOTS_FAILED',{cause:slotError});
  const featured=[];const providerKeys=[];const aliases=new Map();const seen=new Set();
  for(const slot of slots||[]){
    const key=slot.provider_organization_id?`organization:${slot.provider_organization_id}`:`profile:${slot.provider_profile_id}`;
    const candidate=providerByKey.get(key);
    if(!candidate?.eligible||seen.has(key))continue;
    seen.add(key);
    const {provider_organization_id:unusedOrganization,provider_profile_id:unusedProfile,eligible:unusedEligibility,
      base_region_code:unusedRegion,has_profile_image:unusedImage,profile_image_preset:unusedPreset,
      profile_image_updated_at:unusedUpdated,regular_signal:unusedSignal,...safe}=candidate;
    featured.push({...safe,provider_key:key,truck_key:key,
      public_capacity_available:Number(candidate.active_capacity_count)>0,
      map_href:Number(candidate.active_capacity_count)>0?`/?provider=${encodeURIComponent(candidate.handle)}`:null,
      position:slot.slot_position});
    providerKeys.push(key);aliases.set(`vehicle:${slot.vehicle_id}`,key);aliases.set(key,key);
  }
  const {data:placements,error:placementError}=await client.from('sponsor_placements').select('sponsor_id,position').eq('expo_group_key',sponsorGroup.key).eq('active',true).lte('starts_on',featureDate).gte('ends_on',featureDate).order('position').limit(5);
  if(placementError)throw new Error('SUPABASE_PUBLIC_SPONSORS_FAILED',{cause:placementError});
  const sponsorIds=(placements||[]).map(item=>item.sponsor_id);const sponsorResult=sponsorIds.length?await client.from('sponsors').select('id,sponsor_kind,provider_organization_id,provider_profile_id,business_name,description,website_url,phone').in('id',sponsorIds).eq('active',true):{data:[],error:null};
  if(sponsorResult.error)throw new Error('SUPABASE_PUBLIC_SPONSORS_FAILED',{cause:sponsorResult.error});
  const sponsorById=new Map((sponsorResult.data||[]).map(sponsor=>[sponsor.id,sponsor]));const sponsoredProviders=[];
  for(const placement of placements||[]){const sponsor=sponsorById.get(placement.sponsor_id);if(!sponsor)continue;if(sponsor.sponsor_kind==='ADVERTISER'){sponsoredProviders.push({sponsor_kind:'ADVERTISER',name:sponsor.business_name,description:sponsor.description,website_url:sponsor.website_url||null,phone:sponsor.phone||null,sponsor_position:placement.position,sponsored:true});continue;}
    const key=sponsor.provider_organization_id?`organization:${sponsor.provider_organization_id}`:`profile:${sponsor.provider_profile_id}`;const provider=providerByKey.get(key);if(!provider?.eligible)continue;
    const {provider_organization_id:unusedOrganization,provider_profile_id:unusedProfile,eligible:unusedEligibility,base_region_code:unusedRegion,has_profile_image:unusedImage,profile_image_preset:unusedPreset,profile_image_updated_at:unusedUpdated,regular_signal:unusedSignal,...safe}=provider;
    sponsoredProviders.push({...safe,sponsor_kind:'TRANSPORTER',sponsor_position:placement.position,sponsored:true});
  }
  const schedule=assignFeaturedSponsors(featuredSchedule(day,featureDate,providerKeys,aliases),sponsoredProviders);
  return {feature_date:featureDate,base_place:theme.label,expo_group:theme,week:[],theme,
    headline:day.public_headline||'Daily Featured Transport Providers',
    introduction:day.public_introduction||'Meet the transport accounts in today’s showcase and explore the vehicles they publish.',
    tiktok_url:day.tiktok_url,tiktok_broadcast_status:day.tiktok_broadcast_status||'NOT_SCHEDULED',broadcast_start_time:schedule.config.dayStart,broadcast_end_time:schedule.config.dayEnd,schedule,walkthroughs:schedule.walkthroughs,sponsored_providers:sponsoredProviders,providers:featured,published:true};
}
