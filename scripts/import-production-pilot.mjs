import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {assignFixtureDriverPortraits} from './fixture-driver-portraits.mjs';
import {applyManagedFixtureMarketPolicy,applyManagedFixtureVehicleCatalog,ensureIndependentVehicleAssignments} from './fixture-market-policy.mjs';
import {
  PRODUCTION_PILOT_SOURCE,pilotEmail,pilotUuid,validateProductionPilotTarget
} from './production-pilot-policy.mjs';

const argument=name=>process.argv.find(value=>value.startsWith(`${name}=`))?.slice(name.length+1)||'';
const projectRef=String(process.env.SUPABASE_PROJECT_REF||argument('--project-ref')).trim();
const url=String(process.env.SUPABASE_PRODUCTION_URL||'').trim();
const serviceRoleKey=String(process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY||'').trim();
const rollbackRequested=process.argv.includes('--rollback');
const confirmation=argument(rollbackRequested?'--confirm-rollback':'--confirm-additive');
const target=validateProductionPilotTarget({url,projectRef,confirmation});
if(!serviceRoleKey)throw new Error('PRODUCTION_PILOT_SERVICE_ROLE_REQUIRED');

const supabase=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
const fixturePath=path.join(process.cwd(),'resources','fixtures','managed-market.json');
const fixtureDocument=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
if(fixtureDocument.schema_version!==1||!fixtureDocument.tables||!fixtureDocument.captured_at){
  throw new Error('MANAGED_FIXTURE_FORMAT_INVALID');
}
const fixtureAnchor=Date.parse(fixtureDocument.captured_at);
if(!Number.isFinite(fixtureAnchor))throw new Error('MANAGED_FIXTURE_ANCHOR_INVALID');
const fixtureOffset=Date.now()-fixtureAnchor;
const rebaseRow=row=>Object.fromEntries(Object.entries(row).map(([key,value])=>{
  if(value&&key.endsWith('_at')){
    const parsed=Date.parse(String(value));
    if(Number.isFinite(parsed))return [key,new Date(parsed+fixtureOffset).toISOString()];
  }
  return [key,value];
}));
const fixtureTables=Object.fromEntries(Object.entries(fixtureDocument.tables)
  .map(([table,rows])=>[table,Array.isArray(rows)?rows.map(rebaseRow):[]]));
fixtureTables.users=assignFixtureDriverPortraits(fixtureTables.users||[]);
fixtureTables.driver_vehicle_assignments=ensureIndependentVehicleAssignments(
  fixtureTables.vehicles||[],fixtureTables.provider_profiles||[],fixtureTables.driver_vehicle_assignments||[],
  {assignedAt:new Date(fixtureAnchor+fixtureOffset).toISOString()}
);
fixtureTables.vehicles=applyManagedFixtureVehicleCatalog(
  fixtureTables.vehicles||[],fixtureTables.driver_vehicle_assignments||[],fixtureTables.users||[]
);
fixtureTables.capacities=applyManagedFixtureMarketPolicy(fixtureTables.capacities||[],fixtureTables.vehicles||[]);

const {regionalExpoGroupForDate}=await import('../src/lib/provider-regions.js');
const {featuredTruckTypeForDate,selectBalancedFeaturedTruckRows}=await import('../src/lib/featured-trucks.js');
const {ETHIOPIA_PLACES,getPlaceCoordinate}=await import('../src/lib/ethiopia-places.js');
const {normalizePlace}=await import('../src/lib/route-matching.js');
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Addis_Ababa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

function buildFeaturedFixtureTables(){
  const iso=new Date().toISOString();const expo=regionalExpoGroupForDate(today);const theme=featuredTruckTypeForDate(today);
  const organizations=new Map((fixtureTables.organizations||[]).map(row=>[row.id,row]));
  const profiles=new Map((fixtureTables.provider_profiles||[]).map(row=>[row.id,row]));
  const ownerByOrganization=new Map((fixtureTables.memberships||[]).filter(row=>row.membership_role==='OWNER').map(row=>[row.organization_id,row.user_id]));
  const candidates=(fixtureTables.company_pages||[]).filter(page=>Number(page.published)===1)
    .map(page=>{const organization=page.organization_id?organizations.get(page.organization_id):null;const profile=page.provider_profile_id?profiles.get(page.provider_profile_id):null;return {
      organization_id:organization?.id||null,profile_id:profile?.id||null,
      owner_user_id:organization?ownerByOrganization.get(organization.id):profile?.user_id,
      name:organization?.name||profile?.business_name||''
    };}).filter(candidate=>candidate.owner_user_id&&candidate.name).sort((first,second)=>first.name.localeCompare(second.name));
  const candidateByOwner=new Map(candidates.map(candidate=>[candidate.organization_id?`organization:${candidate.organization_id}`:`profile:${candidate.profile_id}`,candidate]));
  const assignmentByVehicle=new Map((fixtureTables.driver_vehicle_assignments||[]).filter(row=>Number(row.active)!==0).map(row=>[row.vehicle_id,row]));
  const eligible=(fixtureTables.vehicles||[]).filter(vehicle=>Number(vehicle.active)!==0&&theme.configurations.includes(vehicle.cargo_configuration))
    .map(vehicle=>{const owner=candidateByOwner.get(vehicle.organization_id?`organization:${vehicle.organization_id}`:`profile:${vehicle.provider_profile_id}`);const assignment=assignmentByVehicle.get(vehicle.id);return owner&&assignment?{vehicle,owner,assignment}:null;})
    .filter(Boolean).sort((first,second)=>String(first.vehicle.platform_number||first.vehicle.id).localeCompare(String(second.vehicle.platform_number||second.vehicle.id)));
  const featured=selectBalancedFeaturedTruckRows(eligible,theme.configurations,8);
  if(!featured.length)throw new Error('PRODUCTION_PILOT_FEATURED_CANDIDATES_MISSING');
  const dayId=`featured-pilot-${today}`;
  const featuredDay={
    id:dayId,feature_date:today,base_place_ref:`featured:${theme.key}`,base_place_label:theme.label,
    expo_group_key:theme.key,expo_group_label:theme.label,expo_region_codes:[],public_headline:'Daily Featured Trucks',
    public_introduction:`Meet today’s ${theme.label.toLowerCase()} and the Drivers operating them.`,tiktok_url:null,
    broadcast_start_time:'07:30',broadcast_end_time:'09:00',schedule_mode:'AUTO',
    schedule_config_json:{dayStart:'07:30',dayEnd:'09:00',targetCount:featured.length,sponsorBreakEvery:2,sponsorBreakMinutes:2},
    manual_schedule_json:[],target_count:featured.length,status:'PUBLISHED',created_by:'user-admin',published_by:'user-admin',
    created_at:iso,updated_at:iso,published_at:iso
  };
  const slots=featured.map((candidate,index)=>({
    id:`featured-pilot-slot-${today}-${index+1}`,day_id:dayId,slot_position:index+1,
    provider_organization_id:candidate.owner.organization_id,provider_profile_id:candidate.owner.profile_id,
    vehicle_id:candidate.vehicle.id,driver_user_id:candidate.assignment.driver_user_id,created_by:'user-admin',created_at:iso
  }));
  const sponsors=candidates.map(candidate=>({
    id:candidate.organization_id?`sponsor-organization-${candidate.organization_id}`:`sponsor-profile-${candidate.profile_id}`,
    sponsor_kind:'TRANSPORTER',provider_organization_id:candidate.organization_id,provider_profile_id:candidate.profile_id,
    business_name:null,description:null,website_url:null,phone:null,active:1,created_by:'user-admin',updated_by:'user-admin',created_at:iso,updated_at:iso
  }));
  const advertiser={id:'sponsor-advertiser-alem-freight-supplies',sponsor_kind:'ADVERTISER',provider_organization_id:null,
    provider_profile_id:null,business_name:'Alem Freight Supplies',description:'Tyres, straps, and roadside essentials for commercial vehicles.',
    website_url:null,phone:'+251900000000',active:1,created_by:'user-admin',updated_by:'user-admin',created_at:iso,updated_at:iso};
  sponsors.push(advertiser);
  const placements=candidates.slice(0,4).map((candidate,index)=>({
    id:`placement-featured-pilot-${today}-${index+1}`,
    sponsor_id:candidate.organization_id?`sponsor-organization-${candidate.organization_id}`:`sponsor-profile-${candidate.profile_id}`,
    expo_group_key:expo.key,starts_on:today,ends_on:today,position:index+1,active:1,
    created_by:'user-admin',updated_by:'user-admin',created_at:iso,updated_at:iso
  }));
  return {featured_provider_days:[featuredDay],featured_provider_slots:slots,sponsors,sponsor_placements:placements};
}
Object.assign(fixtureTables,buildFeaturedFixtureTables());

const openApiResponse=await fetch(`${url}/rest/v1/`,{headers:{apikey:serviceRoleKey,authorization:`Bearer ${serviceRoleKey}`}});
if(!openApiResponse.ok)throw new Error(`PRODUCTION_PILOT_SCHEMA_READ_FAILED:${openApiResponse.status}`);
const openApi=await openApiResponse.json();const definitions=openApi.definitions||openApi.components?.schemas||{};
if(!definitions.profiles?.properties?.driver_portrait_preset)throw new Error('PRODUCTION_PILOT_DRIVER_PORTRAIT_MIGRATION_REQUIRED');

async function listAllAuthUsers(){
  const users=[];let page=1;
  while(true){const {data,error}=await supabase.auth.admin.listUsers({page,perPage:1000});if(error)throw new Error(`PRODUCTION_PILOT_AUTH_LIST_FAILED:${error.message}`);users.push(...data.users);if(data.users.length<1000)return users;page+=1;}
}

const allAuthUsers=await listAllAuthUsers();
const existingPilotUsers=new Map(allAuthUsers.filter(user=>user.app_metadata?.fixture_source===PRODUCTION_PILOT_SOURCE)
  .map(user=>[String(user.user_metadata?.fixture_key||''),user]));
const {data:admins,error:adminError}=await supabase.from('profiles').select('id').eq('role','ADMIN').eq('active',true);
if(adminError)throw new Error(`PRODUCTION_PILOT_ADMIN_LOOKUP_FAILED:${adminError.message}`);
if((admins||[]).length!==1)throw new Error('PRODUCTION_PILOT_SINGLE_ADMIN_REQUIRED');
const adminId=admins[0].id;
const sourceUsers=(fixtureTables.users||[]).filter(user=>['TRANSPORTER','DRIVER'].includes(user.role));
const userIds=new Map([['user-admin',adminId]]);
for(const user of sourceUsers){const existing=existingPilotUsers.get(user.id);if(existing)userIds.set(user.id,existing.id);}

function mapUuid(value){
  if(value===null||value===undefined||value==='')return null;
  const text=String(value);
  if(text==='user-support')throw new Error('PRODUCTION_PILOT_PRIVILEGED_FIXTURE_REFERENCE');
  if(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text))return text;
  return userIds.get(text)||pilotUuid(text);
}

async function preflightPilotCollisions(){
  const checks=[
    ['organizations','handle',fixtureTables.organizations||[]],
    ['provider_profiles','handle',fixtureTables.provider_profiles||[]],
    ['vehicles','platform_number',fixtureTables.vehicles||[]]
  ];
  for(const [table,column,rows] of checks){
    const values=rows.map(row=>row[column]).filter(Boolean);if(!values.length)continue;
    const {data,error}=await supabase.from(table).select(`id,${column}`).in(column,values);
    if(error)throw new Error(`PRODUCTION_PILOT_PREFLIGHT_FAILED:${table}:${error.message}`);
    const expected=new Map(rows.map(row=>[String(row[column]),pilotUuid(row.id)]));
    for(const row of data||[])if(row.id!==expected.get(String(row[column])))throw new Error(`PRODUCTION_PILOT_COLLISION:${table}:${column}`);
  }
  const dayId=pilotUuid(`featured-pilot-${today}`);
  const {data:day,error:dayError}=await supabase.from('featured_provider_days').select('id').eq('feature_date',today).maybeSingle();
  if(dayError)throw new Error(`PRODUCTION_PILOT_PREFLIGHT_FAILED:featured_provider_days:${dayError.message}`);
  if(day&&day.id!==dayId)throw new Error('PRODUCTION_PILOT_FEATURED_DAY_EXISTS');
}
await preflightPilotCollisions();

const aliases={full_name:'name',business_organization_id:'owner_organization_id',photo_storage_path:'photo_path',proof_storage_path:'proof_path',storage_path:'file_path'};
const safePhone='+251900000000';
function convertValue(value,property){
  if(value===null||value===undefined)return null;
  if(property.format==='uuid')return mapUuid(value);
  if(property.type==='boolean'||property.format==='boolean')return Boolean(Number(value));
  if(property.format==='json'||property.format==='jsonb'){
    if(typeof value!=='string')return value;try{return JSON.parse(value);}catch{return value;}
  }
  if(property.type==='integer'||property.type==='number')return Number(value);
  return value;
}
function projectRow(sourceTable,targetTable,row){
  const properties=definitions[targetTable].properties||{};const result={};
  for(const [column,property] of Object.entries(properties)){
    if(column.endsWith('_geog'))continue;
    const sourceColumn=aliases[column]||column;let value=row[sourceColumn];
    if(sourceTable==='users'&&column==='id')value=userIds.get(row.id);
    if(sourceTable==='users'&&column==='email')value=pilotEmail(row.id);
    if(sourceTable==='subscriptions'&&column==='plan_id')value=planIds.get(String(value))||value;
    if(sourceTable==='verification_requests'&&column==='storage_path'&&value)value=`${PRODUCTION_PILOT_SOURCE}/verification-placeholder.jpg`;
    if(['phone','contact_phone','contact_whatsapp'].includes(column)&&value)value=safePhone;
    if(value!==undefined)result[column]=convertValue(value,property);
  }
  if(sourceTable==='capacities'&&(result.market_status||result.status)==='PARTIAL'){
    result.accepts_full_load=false;result.accepts_partial_load=true;
  }
  return result;
}

const plan=[
  ['users','profiles'],['organizations','organizations'],['provider_profiles','provider_profiles'],
  ['memberships','organization_members'],['company_pages','company_pages'],['vehicles','vehicles'],
  ['drivers','drivers'],['driver_permissions','driver_permissions'],['driver_vehicle_assignments','driver_vehicle_assignments'],
  ['subscriptions','subscriptions'],['profile_routes','profile_routes'],['service_areas','service_areas'],
  ['capacities','capacities'],['verification_requests','verification_requests'],
  ['featured_provider_days','featured_provider_days'],['featured_provider_slots','featured_provider_slots'],
  ['sponsors','sponsors'],['sponsor_placements','sponsor_placements']
].filter(([source,targetTable])=>Array.isArray(fixtureTables[source])&&definitions[targetTable]);

async function existingPlans(){
  const sourcePlans=fixtureTables.plans||[];const codes=sourcePlans.map(plan=>plan.code);
  const {data,error}=await supabase.from('plans').select('id,code').in('code',codes);
  if(error)throw new Error(`PRODUCTION_PILOT_PLAN_LOOKUP_FAILED:${error.message}`);
  const byCode=new Map((data||[]).map(plan=>[plan.code,plan.id]));
  for(const plan of sourcePlans){
    if(!byCode.has(plan.code)){
      const row={id:pilotUuid(plan.id),code:plan.code,name:plan.name,audience:plan.audience,active:Boolean(Number(plan.active))};
      const {error:insertError}=await supabase.from('plans').insert(row);
      if(insertError)throw new Error(`PRODUCTION_PILOT_PLAN_INSERT_FAILED:${insertError.message}`);
      byCode.set(plan.code,row.id);
    }
  }
  return new Map(sourcePlans.map(plan=>[plan.id,byCode.get(plan.code)]));
}
const planIds=rollbackRequested?new Map():await existingPlans();
const originalMapUuid=mapUuid;
function mappedUuid(value){return planIds.get(String(value))||originalMapUuid(value);}

function placeRows(){
  const rows=new Map();
  const placeDocument=JSON.parse(fs.readFileSync(path.join(process.cwd(),'resources','geo','ethiopia-settlements.json'),'utf8'));
  const accepted=new Set(['city','town','village','hamlet','suburb','neighbourhood','quarter']);
  for(const element of placeDocument.elements||[]){const tags=element.tags||{};const placeType=String(tags.place||'').toLowerCase();const name=String(tags['name:en']||tags.name||'').trim();const latitude=Number(element.lat??element.center?.lat);const longitude=Number(element.lon??element.center?.lon);if(!accepted.has(placeType)||!name||!Number.isFinite(latitude)||!Number.isFinite(longitude))continue;const id=`osm:${element.type}/${element.id}`;rows.set(id,{id,name,normalized_name:normalizePlace(name),alternate_names:'',place_type:placeType,latitude,longitude,population:null,wikidata_id:tags.wikidata||null,osm_type:element.type,osm_id:String(element.id),source:'OPENSTREETMAP_OVERPASS',parent_place_id:null,parent_name:tags['addr:city']||tags['is_in:city']||null,country_name:'Ethiopia',country_code:'ET'});}
  for(const place of ETHIOPIA_PLACES){const id=`builtin:${normalizePlace(place.name)}`;rows.set(id,{id,name:place.name,normalized_name:normalizePlace(place.name),alternate_names:'',place_type:'city',latitude:place.lat,longitude:place.lng,population:null,wikidata_id:null,osm_type:null,osm_id:null,source:'BUILT_IN',parent_place_id:null,parent_name:null,country_name:'Ethiopia',country_code:'ET'});}
  for(const tableRows of Object.values(fixtureTables))for(const row of tableRows)for(const column of Object.keys(row).filter(key=>key.endsWith('_place_ref'))){const id=String(row[column]||'');if(!id.startsWith('builtin:'))continue;const prefix=column.slice(0,-'_place_ref'.length);const known=getPlaceCoordinate(id.slice('builtin:'.length));const name=String(row[`${prefix}_label`]||row[`${prefix}_place_label`]||known?.name||id.slice(8)).replace(/,\s*Ethiopia$/i,'').trim();const latitude=Number(row[`${prefix}_lat`]??row[`${prefix}_center_lat`]??known?.lat);const longitude=Number(row[`${prefix}_lng`]??row[`${prefix}_center_lng`]??known?.lng);if(!Number.isFinite(latitude)||!Number.isFinite(longitude))continue;rows.set(id,{id,name,normalized_name:normalizePlace(name),alternate_names:'',place_type:'city',latitude,longitude,population:null,wikidata_id:null,osm_type:null,osm_id:null,source:'BUILT_IN',parent_place_id:null,parent_name:null,country_name:'Ethiopia',country_code:'ET'});}
  return [...rows.values()];
}

async function rollback(){
  for(const [sourceTable,targetTable] of [...plan].reverse()){
    const sourceRows=sourceTable==='users'?sourceUsers:fixtureTables[sourceTable];
    const key=targetTable==='driver_permissions'?'user_id':'id';
    const ids=sourceRows.map(row=>sourceTable==='users'?userIds.get(row.id):mappedUuid(key==='user_id'?row.user_id:row.id)).filter(Boolean);
    for(let index=0;index<ids.length;index+=100){const {error}=await supabase.from(targetTable).delete().in(key,ids.slice(index,index+100));if(error)throw new Error(`PRODUCTION_PILOT_ROLLBACK_FAILED:${targetTable}:${error.message}`);}
  }
  const pilotUsers=(await listAllAuthUsers()).filter(user=>user.app_metadata?.fixture_source===PRODUCTION_PILOT_SOURCE);
  for(const user of pilotUsers){const {error}=await supabase.auth.admin.deleteUser(user.id);if(error)throw new Error(`PRODUCTION_PILOT_AUTH_ROLLBACK_FAILED:${error.message}`);}
  await supabase.storage.from('verification').remove([`${PRODUCTION_PILOT_SOURCE}/verification-placeholder.jpg`]);
  process.stdout.write(JSON.stringify({operation:'rollback',projectRef:target.projectRef,authUsers:pilotUsers.length})+'\n');
}

if(rollbackRequested){await rollback();process.exit(0);}

for(const user of sourceUsers){
  if(userIds.has(user.id))continue;
  const {data,error}=await supabase.auth.admin.createUser({
    email:pilotEmail(user.id),password:crypto.randomBytes(32).toString('base64url'),email_confirm:true,
    user_metadata:{full_name:user.name,fixture_key:user.id},
    app_metadata:{fixture_source:PRODUCTION_PILOT_SOURCE,role:user.role}
  });
  if(error||!data.user)throw new Error(`PRODUCTION_PILOT_AUTH_CREATE_FAILED:${user.id}:${error?.message||'missing user'}`);
  userIds.set(user.id,data.user.id);
}

const places=placeRows();
for(let index=0;index<places.length;index+=250){const {error}=await supabase.from('place_catalog').upsert(places.slice(index,index+250),{onConflict:'id'});if(error)throw new Error(`PRODUCTION_PILOT_PLACE_IMPORT_FAILED:${error.message}`);}

const placeholder=fs.readFileSync(path.join(process.cwd(),'public','vehicle-configurations','cargo-van.jpg'));
const {error:storageError}=await supabase.storage.from('verification').upload(`${PRODUCTION_PILOT_SOURCE}/verification-placeholder.jpg`,placeholder,{contentType:'image/jpeg',upsert:true});
if(storageError)throw new Error(`PRODUCTION_PILOT_STORAGE_FAILED:${storageError.message}`);

const counts={};
for(const [sourceTable,targetTable] of plan){
  const sourceRows=sourceTable==='users'?sourceUsers:fixtureTables[sourceTable];if(!sourceRows.length)continue;
  const rows=sourceRows.map(row=>{
    const projected=projectRow(sourceTable,targetTable,row);
    for(const [column,value] of Object.entries(projected))if(definitions[targetTable].properties?.[column]?.format==='uuid')projected[column]=mappedUuid(value);
    return projected;
  });
  for(let index=0;index<rows.length;index+=200){const {error}=await supabase.from(targetTable).upsert(rows.slice(index,index+200),{onConflict:targetTable==='driver_permissions'?'user_id':'id'});if(error)throw new Error(`PRODUCTION_PILOT_IMPORT_FAILED:${targetTable}:${error.message}`);}
  counts[targetTable]=rows.length;
}
process.stdout.write(JSON.stringify({operation:'additive-import',projectRef:target.projectRef,places:places.length,...counts})+'\n');
