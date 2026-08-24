import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const url=String(process.env.SUPABASE_SEED_URL||'').trim();
const serviceRoleKey=String(process.env.SUPABASE_SEED_SERVICE_ROLE_KEY||'').trim();
const anonKey=String(process.env.SUPABASE_SEED_ANON_KEY||'').trim();
const fixturePassword=String(process.env.SUPABASE_FIXTURE_PASSWORD||'Loadgistic123!');

if(!url||!serviceRoleKey||!anonKey)throw new Error('SUPABASE_FIXTURE_VERIFY_CONFIG_MISSING');
const endpoint=new URL(url);
if(!new Set(['127.0.0.1','localhost','::1']).has(endpoint.hostname)){
  throw new Error('REMOTE_FIXTURE_VERIFY_REFUSED');
}

const service=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
const anon=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false}});
const expectedMinimums={profiles:154,vehicles:143,capacities:143,verification_requests:335,place_catalog:3703};

for(const [table,minimum] of Object.entries(expectedMinimums)){
  const {count,error}=await service.from(table).select('*',{count:'exact',head:true});
  if(error)throw new Error(`SUPABASE_FIXTURE_VERIFY_READ_FAILED:${table}:${error.message}`);
  if((count||0)<minimum)throw new Error(`SUPABASE_FIXTURE_VERIFY_COUNT_FAILED:${table}:${count||0}<${minimum}`);
}

const {data:session,error:loginError}=await anon.auth.signInWithPassword({
  email:'company-driver@loadgistic.local',
  password:fixturePassword
});
if(loginError||!session.user||!session.session?.access_token){
  throw new Error(`SUPABASE_FIXTURE_VERIFY_AUTH_FAILED:${loginError?.message||'missing session'}`);
}
const {data:projection,error:projectionError}=await anon.rpc('current_user_projection');
if(projectionError)throw new Error(`SUPABASE_FIXTURE_VERIFY_IDENTITY_FAILED:${projectionError.message}`);
if(projection?.id!==session.user.id||projection?.role!=='DRIVER'||projection?.driver_kind!=='COMPANY'){
  throw new Error('SUPABASE_FIXTURE_VERIFY_IDENTITY_MISMATCH');
}
if(!projection.workspace_subscription)throw new Error('SUPABASE_FIXTURE_VERIFY_SUBSCRIPTION_MISSING');
await anon.auth.signOut();

const {error:anonymousWriteError}=await anon.from('audit_logs').insert({
  id:'fixture-verification-must-not-write',
  action:'FIXTURE_VERIFY'
});
if(!anonymousWriteError)throw new Error('SUPABASE_FIXTURE_VERIFY_ANON_WRITE_ALLOWED');

const {data:objects,error:storageError}=await service.storage.from('verification').list('demo',{
  search:'verification-document.jpg',limit:10
});
if(storageError)throw new Error(`SUPABASE_FIXTURE_VERIFY_STORAGE_FAILED:${storageError.message}`);
if(!objects?.some(object=>object.name==='verification-document.jpg')){
  throw new Error('SUPABASE_FIXTURE_VERIFY_STORAGE_OBJECT_MISSING');
}

process.env.NEXT_PUBLIC_SUPABASE_URL=url;
process.env.SUPABASE_SERVICE_ROLE_KEY=serviceRoleKey;
const {searchSupabasePlaces}=await import('../src/lib/repository/supabase.js');
const placeResults=await searchSupabasePlaces('Addis Ababa','addis ababa',5);
if(!placeResults.some(place=>place.name==='Addis Ababa')){
  throw new Error('SUPABASE_FIXTURE_VERIFY_PLACE_SEARCH_FAILED');
}

const {getSupabasePublicProvider,getSupabasePublicProviderProfileImage,listSupabasePublicCapacityCursor}=await import('../src/lib/repository/supabase.js');
const firstPage=await listSupabasePublicCapacityCursor({},{pageSize:14});
if(firstPage.items.length!==14||!firstPage.hasMore||!firstPage.nextCursor){
  throw new Error('SUPABASE_FIXTURE_VERIFY_CAPACITY_CURSOR_FAILED');
}
if(firstPage.items.some(item=>item.recurring_corridors.length!==1
  ||item.driver_verification_badges.length!==2||item.truck_verification_badges.length!==1)){
  throw new Error('SUPABASE_FIXTURE_VERIFY_CAPACITY_PROJECTION_FAILED');
}
const privateSignal=firstPage.items.find(item=>item.current_signal_geometry_visible===false);
if(privateSignal&&(privateSignal.location_lat!==null||privateSignal.current_route_points.length!==0
  ||privateSignal.capacity_area_boundary.length!==0||privateSignal.recurring_corridors.length!==1
  ||privateSignal.location_update_stage!==null||privateSignal.location_updated_label!==null
  ||privateSignal.location_is_last_reported!==null)){
  throw new Error('SUPABASE_FIXTURE_VERIFY_PRIVATE_CAPACITY_LEAK');
}
const secondPage=await listSupabasePublicCapacityCursor({},{pageSize:14,cursor:firstPage.nextCursor});
const firstIds=new Set(firstPage.items.map(item=>item.id));
if(!secondPage.items.length||secondPage.items.some(item=>firstIds.has(item.id))){
  throw new Error('SUPABASE_FIXTURE_VERIFY_CAPACITY_CURSOR_DUPLICATE');
}
const partialPage=await listSupabasePublicCapacityCursor({status:'PARTIAL'},{pageSize:14});
if(!partialPage.items.length||partialPage.items.some(item=>item.status!=='PARTIAL')){
  throw new Error('SUPABASE_FIXTURE_VERIFY_CAPACITY_STATUS_FILTER_FAILED');
}
const routeSignal=firstPage.items.find(item=>item.current_route_points.length>=2)
  ||firstPage.items.find(item=>item.recurring_corridors.some(signal=>signal.route_points.length>=2));
const routePoints=routeSignal?.current_route_points.length>=2
  ?routeSignal.current_route_points:routeSignal?.recurring_corridors.find(signal=>signal.route_points.length>=2)?.route_points;
if(!routePoints)throw new Error('SUPABASE_FIXTURE_VERIFY_CAPACITY_ROUTE_MISSING');
const routePage=await listSupabasePublicCapacityCursor({
  originPlaceRef:routePoints[0].place_ref,destinationPlaceRef:routePoints.at(-1).place_ref
},{pageSize:14});
if(!routePage.items.length||routePage.items.some(item=>!item.geographic_match_label)){
  throw new Error('SUPABASE_FIXTURE_VERIFY_CAPACITY_ROUTE_FILTER_FAILED');
}
const {error:anonymousCapacityError}=await anon.rpc('public_capacity_page',{
  query:{},cursor_updated_at:null,cursor_id:null,requested_page_size:14
});
if(!anonymousCapacityError)throw new Error('SUPABASE_FIXTURE_VERIFY_PUBLIC_RPC_EXPOSED');

const {data:regionPages,error:regionPageError}=await service.from('company_pages')
  .select('base_region_code').eq('published',true).not('base_region_code','is',null);
if(regionPageError)throw new Error(`SUPABASE_FIXTURE_VERIFY_REGION_READ_FAILED:${regionPageError.message}`);
const regionCodes=[...new Set(regionPages.map(page=>page.base_region_code).filter(Boolean))];
const {data:featuredCandidates,error:featuredCandidateError}=await service.rpc('public_featured_provider_candidates',{
  requested_region_codes:regionCodes
});
if(featuredCandidateError)throw new Error(`SUPABASE_FIXTURE_VERIFY_FEATURED_CANDIDATES_FAILED:${featuredCandidateError.message}`);
let freshnessTarget=null;
for(const payload of featuredCandidates||[]){
  const candidate=payload?.provider_profile_id&&Number(payload.fleet_size)===1&&Number(payload.active_capacity_count)===1?payload:null;
  if(!candidate)continue;
  const {data:vehicle,error:vehicleError}=await service.from('vehicles').select('id')
    .eq('provider_profile_id',candidate.provider_profile_id).eq('active',true).limit(1).maybeSingle();
  if(vehicleError)throw new Error(`SUPABASE_FIXTURE_VERIFY_FRESHNESS_VEHICLE_FAILED:${vehicleError.message}`);
  if(!vehicle)continue;
  const {data:capacity,error:capacityError}=await service.from('capacities').select('*')
    .eq('vehicle_id',vehicle.id).order('updated_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle();
  if(capacityError)throw new Error(`SUPABASE_FIXTURE_VERIFY_FRESHNESS_CAPACITY_FAILED:${capacityError.message}`);
  if(capacity?.visibility==='OPEN'&&['EMPTY','PARTIAL'].includes(capacity.market_status||capacity.status)){
    freshnessTarget={candidate,capacity};
    break;
  }
}
if(!freshnessTarget)throw new Error('SUPABASE_FIXTURE_VERIFY_FRESHNESS_TARGET_MISSING');

const originalExpiry=freshnessTarget.capacity.expires_at;
const offDutyId=randomUUID();
try{
  const {error:expireError}=await service.from('capacities').update({expires_at:'2000-01-01T00:00:00.000Z'})
    .eq('id',freshnessTarget.capacity.id);
  if(expireError)throw new Error(`SUPABASE_FIXTURE_VERIFY_EXPIRE_FAILED:${expireError.message}`);
  const expiredLatest=await listSupabasePublicCapacityCursor({capacityId:freshnessTarget.capacity.id},{pageSize:14});
  if(expiredLatest.items.length!==1)throw new Error('SUPABASE_FIXTURE_VERIFY_EXPIRED_LATEST_HIDDEN');

  const {error:rlsLoginError}=await anon.auth.signInWithPassword({
    email:'company-driver@loadgistic.local',password:fixturePassword
  });
  if(rlsLoginError)throw new Error(`SUPABASE_FIXTURE_VERIFY_RLS_LOGIN_FAILED:${rlsLoginError.message}`);
  const {data:historicalRead,error:historicalReadError}=await anon.from('capacities').select('id')
    .eq('id',freshnessTarget.capacity.id);
  if(historicalReadError)throw new Error(`SUPABASE_FIXTURE_VERIFY_HISTORY_READ_FAILED:${historicalReadError.message}`);
  if(historicalRead?.length)throw new Error('SUPABASE_FIXTURE_VERIFY_HISTORICAL_CAPACITY_EXPOSED');
  await anon.auth.signOut();

  const offDuty={...freshnessTarget.capacity,id:offDutyId,status:'OFF_DUTY',market_status:'OFF_DUTY',
    available_percent:0,accepts_full_load:false,accepts_partial_load:false,
    accepts_multi_pick:false,accepts_multi_drop:false,accepts_multi_stop:false,
    updated_at:new Date(Date.now()+60_000).toISOString(),expires_at:new Date(Date.now()+60_000).toISOString()};
  for(const generated of ['origin_geog','destination_geog','current_origin_geog','current_destination_geog','location_geog'])delete offDuty[generated];
  const {error:offDutyError}=await service.from('capacities').insert(offDuty);
  if(offDutyError)throw new Error(`SUPABASE_FIXTURE_VERIFY_OFF_DUTY_INSERT_FAILED:${offDutyError.message}`);
  const hiddenAfterOffDuty=await listSupabasePublicCapacityCursor({capacityId:freshnessTarget.capacity.id},{pageSize:14});
  if(hiddenAfterOffDuty.items.length)throw new Error('SUPABASE_FIXTURE_VERIFY_OFF_DUTY_PUBLIC');
  const {data:afterOffDuty,error:afterOffDutyError}=await service.rpc('public_featured_provider_candidates',{
    requested_region_codes:[freshnessTarget.candidate.base_region_code]
  });
  if(afterOffDutyError)throw new Error(`SUPABASE_FIXTURE_VERIFY_OFF_DUTY_FEATURED_FAILED:${afterOffDutyError.message}`);
  const featuredAfter=(afterOffDuty||[]).find(row=>row.provider_profile_id===freshnessTarget.candidate.provider_profile_id);
  if(!featuredAfter||Number(featuredAfter.active_capacity_count)!==0){
    throw new Error('SUPABASE_FIXTURE_VERIFY_OFF_DUTY_FEATURED_COUNT');
  }
}finally{
  await anon.auth.signOut();
  await service.from('capacities').delete().eq('id',offDutyId);
  await service.from('capacities').update({expires_at:originalExpiry}).eq('id',freshnessTarget.capacity.id);
}

for(const handle of ['blueline-transport','abebe-owner-operator']){
  const provider=await getSupabasePublicProvider(handle);
  if(!provider||!provider.trucks.length||provider.trucks.some(truck=>
    !Array.isArray(truck.driver_verification_badges)||!Array.isArray(truck.truck_verification_badges))){
    throw new Error(`SUPABASE_FIXTURE_VERIFY_PROVIDER_PROJECTION_FAILED:${handle}`);
  }
  if(provider.trucks.some(truck=>truck.capacity&&(!truck.assigned_driver_first_name||!truck.driver_kind_label))){
    throw new Error(`SUPABASE_FIXTURE_VERIFY_PROVIDER_DRIVER_FAILED:${handle}`);
  }
}
if(await getSupabasePublicProvider('unknown-provider-handle')!==null){
  throw new Error('SUPABASE_FIXTURE_VERIFY_UNKNOWN_PROVIDER_EXPOSED');
}
if(await getSupabasePublicProviderProfileImage('unknown-provider-handle')!==null){
  throw new Error('SUPABASE_FIXTURE_VERIFY_UNKNOWN_PROVIDER_IMAGE_EXPOSED');
}
const {error:anonymousProviderSummaryError}=await anon.rpc('public_provider_review_summary',{
  requested_organization_id:null,requested_provider_profile_id:null
});
if(!anonymousProviderSummaryError)throw new Error('SUPABASE_FIXTURE_VERIFY_PROVIDER_RPC_EXPOSED');

const {getSupabaseDailyFeaturedProviders}=await import('../src/lib/repository/supabase.js');
const featured=await getSupabaseDailyFeaturedProviders();
if(!featured.published||!featured.providers.length||featured.walkthroughs.length!==featured.providers.length){
  throw new Error('SUPABASE_FIXTURE_VERIFY_FEATURED_PROJECTION_FAILED');
}
if(featured.providers.some(provider=>Object.keys(provider).some(key=>key.endsWith('_id')||key==='eligible'))
  ||featured.sponsored_providers.some(sponsor=>Object.keys(sponsor).some(key=>key.endsWith('_id')||key==='eligible'))){
  throw new Error('SUPABASE_FIXTURE_VERIFY_FEATURED_PRIVATE_KEY_EXPOSED');
}
const {error:anonymousFeaturedError}=await anon.rpc('public_featured_provider_candidates',{
  requested_region_codes:['ADDIS_ABABA']
});
if(!anonymousFeaturedError)throw new Error('SUPABASE_FIXTURE_VERIFY_FEATURED_RPC_EXPOSED');

process.stdout.write('Local Supabase fixture verification passed.\n');
