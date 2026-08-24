import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const url=String(process.env.SUPABASE_SEED_URL||'').trim();
const serviceRoleKey=String(process.env.SUPABASE_SEED_SERVICE_ROLE_KEY||'').trim();
const fixturePassword=String(process.env.SUPABASE_FIXTURE_PASSWORD||'Loadgistic123!');
const resetRequested=process.argv.includes('--reset-local');

if(!url||!serviceRoleKey)throw new Error('SUPABASE_FIXTURE_CONFIG_MISSING');
const endpoint=new URL(url);
const localHosts=new Set(['127.0.0.1','localhost','::1']);
if(!localHosts.has(endpoint.hostname))throw new Error('REMOTE_FIXTURE_IMPORT_REFUSED');
if(!resetRequested)throw new Error('LOCAL_FIXTURE_RESET_CONFIRMATION_REQUIRED');

process.env.DATABASE_PATH=path.join(process.cwd(),'data','supabase-fixture-source.db');
const {getDb}=await import('../src/lib/db.js');
const {hashTrackingAccessCode,reviewAccessCode,trackingAccessCode}=await import('../src/lib/security.js');
const {ETHIOPIA_PLACES,getPlaceCoordinate}=await import('../src/lib/ethiopia-places.js');
const {normalizePlace}=await import('../src/lib/route-matching.js');
const sqlite=getDb();
const supabase=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});

const openApiResponse=await fetch(`${url}/rest/v1/`,{
  headers:{apikey:serviceRoleKey,authorization:`Bearer ${serviceRoleKey}`}
});
if(!openApiResponse.ok)throw new Error(`SUPABASE_SCHEMA_READ_FAILED:${openApiResponse.status}`);
const openApi=await openApiResponse.json();
const definitions=openApi.definitions||openApi.components?.schemas||{};

const plan=[
  ['place_catalog','place_catalog'],
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
  ['applications','applications'],
  ['partner_relationships','partner_relationships'],
  ['profile_routes','profile_routes'],
  ['service_areas','service_areas'],
  ['capacities','capacities'],
  ['shipments','shipments'],
  ['shipment_events','shipment_events'],
  ['shipment_interests','shipment_interests'],
  ['business_reviews','business_reviews'],
  ['proof_files','proof_files'],
  ['provider_shipments','provider_shipments'],
  ['provider_shipment_events','provider_shipment_events'],
  ['shipment_party_grants','shipment_party_grants'],
  ['email_deliveries','email_deliveries'],
  ['provider_reviews','provider_reviews'],
  ['verification_requests','verification_requests'],
  ['support_agent_profiles','support_agent_profiles'],
  ['support_conversations','support_conversations'],
  ['support_messages','support_messages'],
  ['support_events','support_events'],
  ['featured_provider_days','featured_provider_days'],
  ['featured_provider_slots','featured_provider_slots'],
  ['provider_sponsorships','provider_sponsorships'],
  ['sponsors','sponsors'],
  ['sponsor_placements','sponsor_placements'],
  ['capacity_access_grants','capacity_access_grants'],
  ['shared_capacity_email_otps','shared_capacity_email_otps'],
  ['access_email_deliveries','access_email_deliveries'],
  ['guest_support_conversations','guest_support_conversations'],
  ['guest_support_messages','guest_support_messages'],
  ['guest_support_attachments','guest_support_attachments'],
  ['guest_support_events','guest_support_events'],
  ['notifications','notifications'],
  ['audit_logs','audit_logs']
].filter(([source,target])=>tableExists(source)&&definitions[target]);

const aliases={
  full_name:'name',
  business_organization_id:'owner_organization_id',
  photo_storage_path:'photo_path',
  proof_storage_path:'proof_path',
  storage_path:'file_path'
};

function tableExists(table){
  return Boolean(sqlite.prepare("select 1 from sqlite_master where type='table' and name=?").get(table));
}

function uuidFor(value){
  const bytes=crypto.createHash('sha256').update(`loadgistic-fixture:${value}`).digest().subarray(0,16);
  bytes[6]=(bytes[6]&0x0f)|0x40;
  bytes[8]=(bytes[8]&0x3f)|0x80;
  const hex=bytes.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

async function deleteLocalFixtures(){
  const deleteKeys={driver_permissions:'user_id',support_agent_profiles:'user_id'};
  for(const [,table] of [...plan].reverse()){
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
for(const {name:table} of sqlite.prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%'").all()){
  const columns=sqlite.prepare(`pragma table_info("${table}")`).all().map(column=>column.name);
  for(const placeRefColumn of columns.filter(column=>column.endsWith('_place_ref'))){
    const prefix=placeRefColumn.slice(0,-'_place_ref'.length);
    for(const row of sqlite.prepare(`select * from "${table}" where "${placeRefColumn}" is not null`).all()){
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

const sourceUsers=sqlite.prepare('select * from users order by id').all();
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
    if(sourceTable==='provider_shipments'&&column==='review_code_hash'){
      value=hashTrackingAccessCode(reviewAccessCode(mapUuid(row.id)));
    }
    if(sourceTable==='shipment_party_grants'&&column==='code_hash'){
      value=hashTrackingAccessCode(trackingAccessCode(mapUuid(row.shipment_id)));
    }
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
  const sourceRows=sourceTable==='users'?sourceUsers:sqlite.prepare(`select * from "${sourceTable}"`).all();
  if(!sourceRows.length)continue;
  const rows=sourceRows.map(row=>projectRow(sourceTable,targetTable,row));
  for(let index=0;index<rows.length;index+=250){
    const {error}=await supabase.from(targetTable).insert(rows.slice(index,index+250));
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
