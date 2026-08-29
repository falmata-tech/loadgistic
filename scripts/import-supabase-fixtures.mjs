import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const url=String(process.env.SUPABASE_SEED_URL||'').trim();
const serviceRoleKey=String(process.env.SUPABASE_SEED_SERVICE_ROLE_KEY||'').trim();
const fixturePassword=String(process.env.SUPABASE_FIXTURE_PASSWORD||'Loadgistic123!');
const resetRequested=process.argv.includes('--reset-local');

if(!url||!serviceRoleKey)throw new Error('SUPABASE_FIXTURE_CONFIG_MISSING');
if(process.env.NODE_ENV==='production')throw new Error('PRODUCTION_FIXTURE_IMPORT_REFUSED');
const endpoint=new URL(url);
const localHosts=new Set(['127.0.0.1','localhost','::1']);
if(!localHosts.has(endpoint.hostname))throw new Error('REMOTE_FIXTURE_IMPORT_REFUSED');
if(!resetRequested)throw new Error('LOCAL_FIXTURE_RESET_CONFIRMATION_REQUIRED');

const {regionalExpoGroupForDate}=await import('../src/lib/provider-regions.js');
const {ETHIOPIA_PLACES,getPlaceCoordinate}=await import('../src/lib/ethiopia-places.js');
const {normalizePlace}=await import('../src/lib/route-matching.js');
const today=new Intl.DateTimeFormat('en-CA',{
  timeZone:'Africa/Addis_Ababa',year:'numeric',month:'2-digit',day:'2-digit'
}).format(new Date());
const fixturePath=path.join(process.cwd(),'resources','fixtures','managed-market.json');
const fixtureDocument=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
if(fixtureDocument.schema_version!==1||!fixtureDocument.tables||!fixtureDocument.captured_at){
  throw new Error('MANAGED_FIXTURE_FORMAT_INVALID');
}
const fixtureAnchor=Date.parse(fixtureDocument.captured_at);
if(!Number.isFinite(fixtureAnchor))throw new Error('MANAGED_FIXTURE_ANCHOR_INVALID');
const fixtureOffset=Date.now()-fixtureAnchor;

function rebaseFixtureRow(row){
  return Object.fromEntries(Object.entries(row).map(([key,value])=>{
    if(value&&key.endsWith('_at')){
      const parsed=Date.parse(String(value));
      if(Number.isFinite(parsed))return [key,new Date(parsed+fixtureOffset).toISOString()];
    }
    return [key,value];
  }));
}

const fixtureTables=Object.fromEntries(Object.entries(fixtureDocument.tables)
  .map(([table,rows])=>[table,Array.isArray(rows)?rows.map(rebaseFixtureRow):[]]));

function buildFeaturedFixtureTables(){
  const iso=new Date().toISOString();
  const expo=regionalExpoGroupForDate(today);
  const organizations=new Map((fixtureTables.organizations||[]).map(row=>[row.id,row]));
  const profiles=new Map((fixtureTables.provider_profiles||[]).map(row=>[row.id,row]));
  const ownerByOrganization=new Map((fixtureTables.memberships||[])
    .filter(row=>row.membership_role==='OWNER').map(row=>[row.organization_id,row.user_id]));
  const candidates=(fixtureTables.company_pages||[]).filter(page=>Number(page.published)===1
    &&(String(page.id).startsWith('page-public-fleet-')||String(page.id).startsWith('page-public-owner-')))
    .map(page=>{
      const organization=page.organization_id?organizations.get(page.organization_id):null;
      const profile=page.provider_profile_id?profiles.get(page.provider_profile_id):null;
      return {
        organization_id:organization?.id||null,profile_id:profile?.id||null,
        owner_user_id:organization?ownerByOrganization.get(organization.id):profile?.user_id,
        name:organization?.name||profile?.business_name||'',base_region_code:page.base_region_code
      };
    }).filter(candidate=>candidate.owner_user_id&&candidate.name).sort((first,second)=>first.name.localeCompare(second.name));
  const featured=candidates.filter(candidate=>expo.regionCodes.includes(candidate.base_region_code));
  if(!featured.length)throw new Error('MANAGED_FIXTURE_FEATURED_CANDIDATES_MISSING');
  const dayId=`featured-demo-${today}`;
  const featuredDay={
    id:dayId,feature_date:today,base_place_ref:`featured:${expo.key}`,base_place_label:expo.title,
    expo_group_key:expo.key,expo_group_label:expo.title,expo_region_codes:expo.regionCodes,
    public_headline:'Daily Featured Transporters',
    public_introduction:`Meet transporters based in ${expo.title}, then find their current trucks in the Truck Market.`,
    tiktok_url:null,broadcast_start_time:'08:00',broadcast_end_time:'22:00',schedule_mode:'AUTO',
    schedule_config_json:{},manual_schedule_json:[],status:'PUBLISHED',created_by:'user-admin',
    published_by:'user-admin',created_at:iso,updated_at:iso,published_at:iso
  };
  const slots=featured.map((candidate,index)=>({
    id:`featured-demo-slot-${today}-${index+1}`,day_id:dayId,slot_position:index+1,
    provider_organization_id:candidate.organization_id,provider_profile_id:candidate.profile_id,
    created_by:'user-admin',created_at:iso
  }));
  const sponsors=candidates.map(candidate=>({
    id:candidate.organization_id?`sponsor-organization-${candidate.organization_id}`:`sponsor-profile-${candidate.profile_id}`,
    sponsor_kind:'TRANSPORTER',provider_organization_id:candidate.organization_id,
    provider_profile_id:candidate.profile_id,business_name:null,description:null,website_url:null,phone:null,
    active:1,created_by:'user-admin',updated_by:'user-admin',created_at:iso,updated_at:iso
  }));
  const advertiser={
    id:'sponsor-advertiser-alem-freight-supplies',sponsor_kind:'ADVERTISER',
    provider_organization_id:null,provider_profile_id:null,business_name:'Alem Freight Supplies',
    description:'Tyres, straps, and roadside essentials for commercial vehicles.',website_url:null,
    phone:'+251911555019',active:1,created_by:'user-admin',updated_by:'user-admin',created_at:iso,updated_at:iso
  };
  sponsors.push(advertiser);
  const positions=[1,3,4,5];
  const placements=featured.slice(0,4).map((candidate,index)=>({
    id:`placement-featured-demo-${today}-${index+1}`,
    sponsor_id:candidate.organization_id?`sponsor-organization-${candidate.organization_id}`:`sponsor-profile-${candidate.profile_id}`,
    expo_group_key:expo.key,starts_on:today,ends_on:today,position:positions[index],active:1,
    created_by:'user-admin',updated_by:'user-admin',created_at:iso,updated_at:iso
  }));
  placements.splice(1,0,{
    id:`placement-sponsor-advertiser-${today}`,sponsor_id:advertiser.id,expo_group_key:expo.key,
    starts_on:today,ends_on:today,position:2,active:1,created_by:'user-admin',updated_by:'user-admin',
    created_at:iso,updated_at:iso
  });
  return {featured_provider_days:[featuredDay],featured_provider_slots:slots,sponsors,sponsor_placements:placements};
}

Object.assign(fixtureTables,buildFeaturedFixtureTables());
const supabase=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});

const openApiResponse=await fetch(`${url}/rest/v1/`,{
  headers:{apikey:serviceRoleKey,authorization:`Bearer ${serviceRoleKey}`}
});
if(!openApiResponse.ok)throw new Error(`SUPABASE_SCHEMA_READ_FAILED:${openApiResponse.status}`);
const openApi=await openApiResponse.json();
const definitions=openApi.definitions||openApi.components?.schemas||{};

const plan=[
  ['users','profiles'],
  ['organizations','organizations'],
  ['provider_profiles','provider_profiles'],
  ['memberships','organization_members'],
  ['company_pages','company_pages'],
  ['vehicles','vehicles'],
  ['drivers','drivers'],
  ['driver_permissions','driver_permissions'],
  ['driver_vehicle_assignments','driver_vehicle_assignments'],
  ['plans','plans'],
  ['subscriptions','subscriptions'],
  ['profile_routes','profile_routes'],
  ['service_areas','service_areas'],
  ['capacities','capacities'],
  ['verification_requests','verification_requests'],
  ['support_agent_profiles','support_agent_profiles'],
  ['featured_provider_days','featured_provider_days'],
  ['featured_provider_slots','featured_provider_slots'],
  ['sponsors','sponsors'],
  ['sponsor_placements','sponsor_placements'],
  ['notifications','notifications']
].filter(([source,target])=>Array.isArray(fixtureTables[source])&&definitions[target]);

const localResetTables=[
  'place_catalog','profiles','organizations','provider_profiles','organization_members','company_pages','vehicles',
  'drivers','driver_permissions','driver_vehicle_assignments','plans','subscriptions','applications',
  'partner_relationships','profile_routes','service_areas','capacities','shipments','shipment_events',
  'shipment_interests','business_reviews','proof_files','provider_shipments','provider_shipment_events',
  'shipment_party_grants','email_deliveries','provider_reviews','verification_requests','support_agent_profiles',
  'support_conversations','support_messages','support_events','featured_provider_days','featured_provider_slots',
  'provider_sponsorships','sponsors','sponsor_placements','capacity_access_grants','shared_capacity_email_otps',
  'access_email_deliveries','guest_support_conversations','guest_support_messages','guest_support_attachments',
  'guest_support_events','notifications','audit_logs'
].filter(table=>definitions[table]);

const aliases={
  full_name:'name',
  business_organization_id:'owner_organization_id',
  photo_storage_path:'photo_path',
  proof_storage_path:'proof_path',
  storage_path:'file_path'
};

function uuidFor(value){
  const bytes=crypto.createHash('sha256').update(`loadgistic-fixture:${value}`).digest().subarray(0,16);
  bytes[6]=(bytes[6]&0x0f)|0x40;
  bytes[8]=(bytes[8]&0x3f)|0x80;
  const hex=bytes.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

async function deleteLocalFixtures(){
  const deleteKeys={driver_permissions:'user_id',support_agent_profiles:'user_id'};
  for(const table of [...localResetTables].reverse()){
    const deleteKey=deleteKeys[table]||'id';
    const {error}=await supabase.from(table).delete().not(deleteKey,'is',null);
    if(error&&!/does not exist/i.test(error.message))throw new Error(`FIXTURE_CLEAR_FAILED:${table}:${error.message}`);
  }
  let page=1;
  while(true){
    const {data,error}=await supabase.auth.admin.listUsers({page,perPage:1000});
    if(error)throw new Error(`AUTH_LIST_FAILED:${error.message}`);
    const fixtures=data.users.filter(user=>user.app_metadata?.fixture_source==='loadgistic');
    for(const user of fixtures){
      const {error:deleteError}=await supabase.auth.admin.deleteUser(user.id);
      if(deleteError)throw new Error(`AUTH_DELETE_FAILED:${deleteError.message}`);
    }
    if(data.users.length<1000)break;
    page+=1;
  }
}

await deleteLocalFixtures();

function alternateNames(tags){
  return [...new Set([
    tags.name,tags.alt_name,tags.short_name,tags['name:en'],tags['name:am'],
    tags['name:om'],tags['name:ti'],tags['name:so']
  ].filter(Boolean).flatMap(value=>String(value).split(';')).map(value=>value.trim()).filter(Boolean))].join('; ');
}

const placeRows=new Map();
const placeDocument=JSON.parse(fs.readFileSync(path.join(process.cwd(),'resources','geo','ethiopia-settlements.json'),'utf8'));
const acceptedPlaceTypes=new Set(['city','town','village','hamlet','suburb','neighbourhood','quarter']);
for(const element of placeDocument.elements||[]){
  const tags=element.tags||{};
  const placeType=String(tags.place||'').toLowerCase();
  const name=String(tags['name:en']||tags.name||'').trim();
  const latitude=Number(element.lat??element.center?.lat);
  const longitude=Number(element.lon??element.center?.lon);
  if(!acceptedPlaceTypes.has(placeType)||!name||!Number.isFinite(latitude)||!Number.isFinite(longitude))continue;
  const population=Number.parseInt(String(tags.population||''),10);
  const id=`osm:${element.type}/${element.id}`;
  placeRows.set(id,{
    id,name,normalized_name:normalizePlace(name),alternate_names:alternateNames(tags),place_type:placeType,
    latitude,longitude,population:Number.isFinite(population)?population:null,wikidata_id:tags.wikidata||null,
    osm_type:element.type,osm_id:String(element.id),source:'OPENSTREETMAP_OVERPASS',parent_place_id:null,
    parent_name:tags['addr:city']||tags['is_in:city']||(['suburb','neighbourhood','quarter'].includes(placeType)?'Addis Ababa':null),
    country_name:'Ethiopia',country_code:'ET'
  });
}
for(const place of ETHIOPIA_PLACES){
  const id=`builtin:${normalizePlace(place.name)}`;
  placeRows.set(id,{
    id,name:place.name,normalized_name:normalizePlace(place.name),alternate_names:'',place_type:'city',
    latitude:place.lat,longitude:place.lng,population:null,wikidata_id:null,osm_type:null,osm_id:null,
    source:'BUILT_IN',parent_place_id:null,parent_name:null,country_name:'Ethiopia',country_code:'ET'
  });
}
for(const rows of Object.values(fixtureTables)){
  for(const row of rows){
    const columns=Object.keys(row);
    for(const placeRefColumn of columns.filter(column=>column.endsWith('_place_ref'))){
    const prefix=placeRefColumn.slice(0,-'_place_ref'.length);
      const id=String(row[placeRefColumn]);
      if(!id.startsWith('builtin:'))continue;
      const localName=id.slice('builtin:'.length);
      const known=getPlaceCoordinate(localName);
      const name=String(
        row[`${prefix}_label`]||row[`${prefix}_place_label`]||
        (prefix==='city'?row.city:null)||(prefix==='origin'?row.origin:null)||
        (prefix==='destination'?row.destination:null)||(prefix==='current_origin'?row.current_route_origin:null)||
        (prefix==='current_destination'?row.current_route_destination:null)||known?.name||localName
      ).replace(/,\s*Ethiopia$/i,'').trim();
      const latitude=Number(row[`${prefix}_lat`]??row[`${prefix}_center_lat`]??known?.lat);
      const longitude=Number(row[`${prefix}_lng`]??row[`${prefix}_center_lng`]??known?.lng);
      if(!Number.isFinite(latitude)||!Number.isFinite(longitude))continue;
      placeRows.set(id,{
        id,name,normalized_name:normalizePlace(name),alternate_names:'',place_type:'city',latitude,longitude,
        population:null,wikidata_id:null,osm_type:null,osm_id:null,source:'BUILT_IN',parent_place_id:null,
        parent_name:null,country_name:'Ethiopia',country_code:'ET'
      });
    }
  }
}
const catalog=[...placeRows.values()];
for(let index=0;index<catalog.length;index+=250){
  const {error}=await supabase.from('place_catalog').insert(catalog.slice(index,index+250));
  if(error)throw new Error(`FIXTURE_IMPORT_FAILED:place_catalog:${error.message}`);
}
process.stdout.write(`place_catalog: ${catalog.length}\n`);

const sourceUsers=fixtureTables.users;
const userIds=new Map();
for(const user of sourceUsers){
  const {data,error}=await supabase.auth.admin.createUser({
    email:user.email,
    password:fixturePassword,
    email_confirm:true,
    user_metadata:{full_name:user.name,fixture_key:user.id},
    app_metadata:{fixture_source:'loadgistic',role:user.role}
  });
  if(error||!data.user)throw new Error(`AUTH_CREATE_FAILED:${user.email}:${error?.message||'missing user'}`);
  userIds.set(user.id,data.user.id);
}

function mapUuid(value){
  if(value===null||value===undefined||value==='')return null;
  if(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value)))return String(value);
  return userIds.get(String(value))||uuidFor(String(value));
}

function convertValue(value,property){
  if(value===null||value===undefined)return null;
  if(property.format==='uuid')return mapUuid(value);
  if(property.type==='boolean'||property.format==='boolean')return Boolean(Number(value));
  if(property.format==='json'||property.format==='jsonb'){
    if(typeof value!=='string')return value;
    try{return JSON.parse(value);}catch{return value;}
  }
  if(property.type==='integer')return Number(value);
  if(property.type==='number')return Number(value);
  return value;
}

function projectRow(sourceTable,targetTable,row){
  const properties=definitions[targetTable].properties||{};
  const result={};
  for(const [column,property] of Object.entries(properties)){
    if(column.endsWith('_geog'))continue;
    let sourceColumn=aliases[column]||column;
    let value=row[sourceColumn];
    if(sourceTable==='users'&&column==='id')value=userIds.get(row.id);
    if(sourceTable==='verification_requests'&&column==='storage_path'&&value)value='demo/verification-document.jpg';
    if(value!==undefined)result[column]=convertValue(value,property);
  }
  if(sourceTable==='capacities'&&(result.market_status||result.status)==='PARTIAL'){
    result.accepts_full_load=false;
    result.accepts_partial_load=true;
  }
  return result;
}

for(const [sourceTable,targetTable] of plan){
  const sourceRows=sourceTable==='users'?sourceUsers:fixtureTables[sourceTable];
  if(!sourceRows.length)continue;
  const rows=sourceRows.map(row=>projectRow(sourceTable,targetTable,row));
  for(let index=0;index<rows.length;index+=250){
    const batch=rows.slice(index,index+250);
    const operation=targetTable==='profiles'
      ?supabase.from(targetTable).upsert(batch,{onConflict:'id'})
      :supabase.from(targetTable).insert(batch);
    const {error}=await operation;
    if(error)throw new Error(`FIXTURE_IMPORT_FAILED:${sourceTable}->${targetTable}:${error.message}`);
  }
  process.stdout.write(`${targetTable}: ${rows.length}\n`);
}

const demoDocument=fs.readFileSync(path.join(process.cwd(),'public','vehicle-configurations','cargo-van.jpg'));
const {error:storageError}=await supabase.storage.from('verification').upload(
  'demo/verification-document.jpg',
  demoDocument,
  {contentType:'image/jpeg',upsert:true}
);
if(storageError)throw new Error(`FIXTURE_STORAGE_FAILED:${storageError.message}`);

process.stdout.write(`Supabase fixtures imported: ${sourceUsers.length} users\n`);
