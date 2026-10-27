import test from 'node:test';
import assert from 'node:assert/strict';
import {listSupabasePublicCapacityCursor,listSupabaseAccountCapacity,getSupabasePublicProvider} from '../src/lib/repository/supabase.js';
import {emptyTruckAuthority} from '../src/lib/provider-authority-contract.js';

const ownerId='00000000-0000-4000-8000-000000000001',providerId='00000000-0000-4000-8000-000000000002',vehicleId='00000000-0000-4000-8000-000000000003',driverId='00000000-0000-4000-8000-000000000004';
const reviewed=type=>({verification_type:type,reviewed_at:'2026-10-14T00:00:00Z',expires_on:null});
async function withResponses(reply,run){
 const prior={fetch:globalThis.fetch,url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY},calls=[];
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://driver-presentation.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-offline-key';
 globalThis.fetch=async(value,init)=>{const url=new URL(String(value));assert.equal(url.hostname,'driver-presentation.invalid');const call={path:url.pathname,query:url.searchParams,body:init?.body?JSON.parse(init.body):null};calls.push(call);return new Response(JSON.stringify(reply(call)),{status:200,headers:{'Content-Type':'application/json'}});};
 try{await run(calls);}finally{globalThis.fetch=prior.fetch;for(const [key,value] of [['NEXT_PUBLIC_SUPABASE_URL',prior.url],['SUPABASE_SERVICE_ROLE_KEY',prior.key]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
}

test('public and private capacity label the actual assigned person Driver without inheriting employer identity evidence',async()=>{
 for(const kind of ['FLEET_TRANSPORTER','SELF_MANAGED_DRIVER','OWNER_OPERATOR'])for(const audience of ['public','private']){
  const row={id:'capacity',vehicle_id:vehicleId,provider_kind:kind,provider_organization_id:kind==='FLEET_TRANSPORTER'?providerId:null,provider_profile_id:kind==='FLEET_TRANSPORTER'?null:providerId,assigned_driver_first_name:'Assigned',updated_at:'2026-10-14T00:00:00Z',location_updated_at:'2026-10-14T00:00:00Z',status:'EMPTY',driver_documents:[reviewed('DRIVER_IDENTITY')],vehicle_documents:[reviewed('VEHICLE_OWNERSHIP')],authorization_documents:[],authority:emptyTruckAuthority()};
  await withResponses(call=>{
   if(call.path==='/rest/v1/rpc/public_capacity_page'||call.path==='/rest/v1/rpc/account_capacity_filtered_page')return [{payload:row}];
   if(call.path==='/rest/v1/rpc/capacity_owner_documents')return [{subject_id:providerId,subject_type:kind==='FLEET_TRANSPORTER'?'ORGANIZATION':'PROVIDER_PROFILE',documents:[reviewed('IDENTITY')]}];
   assert.fail('Unexpected projection query');
  },async calls=>{
   const page=audience==='public'?await listSupabasePublicCapacityCursor():await listSupabaseAccountCapacity(ownerId,'a'.repeat(64));assert.equal(page.items.length,1);const item=page.items[0];
   assert.equal(item.driver_kind_label,'Driver');assert.equal(item.driver_kind,kind==='FLEET_TRANSPORTER'?'COMPANY_DRIVER':kind,'Existing machine enums remain compatible');assert.equal(item.assigned_driver_first_name,'Assigned');
   assert.equal(item.driver_verification_badges.find(badge=>badge.type==='DRIVER_IDENTITY').verified,true);assert.equal(item.driver_verification_badges.find(badge=>badge.type==='IDENTITY').verified,false,'Employer identity must not become driver identity');assert.equal(item.owner_verification_badges.find(badge=>badge.type==='IDENTITY').verified,true);
   assert.equal(item.truck_verification_badges.find(badge=>badge.type==='VEHICLE_OWNERSHIP').verified,false,'Historical approval without current authority cannot appear verified');
   assert.equal(calls.length,2,'Neutral presentation adds no identity lookup per row');assert.equal(row.driver_documents.length,1);
  });
 }
});

test('public profile trucks without current capacity use actual employee/owner document subjects and the same neutral label',async()=>{
 for(const kind of ['ORGANIZATION','PROVIDER_PROFILE']){
  const company=kind==='ORGANIZATION',assigned=company?ownerId:driverId,documents=[{...reviewed('IDENTITY'),subject_type:kind,subject_id:providerId},{...reviewed('DRIVER_IDENTITY'),subject_type:'DRIVER',subject_id:assigned},{...reviewed('VEHICLE_OWNERSHIP'),subject_type:'VEHICLE',subject_id:vehicleId}];
  await withResponses(call=>{
   if(call.path==='/rest/v1/organizations')return company?[{id:providerId,name:'Business',handle:'provider',type:'TRANSPORT_COMPANY'}]:[];
   if(call.path==='/rest/v1/provider_profiles')return company?[]:[{id:providerId,user_id:ownerId,handle:'provider'}];
   if(call.path==='/rest/v1/provider_reviews')return [];
   if(call.path==='/rest/v1/verification_requests'){const type=call.query.get('subject_type'),ids=call.query.get('subject_id')||'';return documents.filter(row=>type==='eq.'+row.subject_type&&ids.includes(row.subject_id));}
   if(call.path==='/rest/v1/rpc/public_provider_page_details')return {public_name:'First',show_contact_phone:false};
   if(call.path==='/rest/v1/rpc/public_provider_review_summary')return {review_count:0,average_rating:null};
   if(call.path==='/rest/v1/rpc/public_person_identities')return [{id:assigned,first_name:'Assigned',callback_phone:null,portrait_url:null}];
   if(call.path==='/rest/v1/rpc/public_provider_fleet_page')return {items:[{id:vehicleId,platform_number:'LG-TEST',make:'Truck',model:'Example',category:'Light',cargo_configuration:'Mini Box Truck',assigned_driver_id:assigned,authority:emptyTruckAuthority()}],total:1,page:1,page_count:1,page_size:12,owner_operator:false,evidence:null,authority_summary:{total:1,ownershipVerified:0,operatingLicenceVerified:0,financedVerified:0,permissionVerified:0,notYetVerified:1}};
   if(call.path==='/rest/v1/rpc/public_capacity_page')return [];
   assert.fail('Unexpected profile query');
  },async calls=>{
   const provider=await getSupabasePublicProvider('provider');assert.equal(provider.provider_kind_label,'Transport Provider');assert.equal(provider.trucks[0].driver_kind_label,'Driver');assert.equal(provider.trucks[0].assigned_driver_first_name,'Assigned');assert.equal(provider.trucks[0].driver_verification_badges.find(badge=>badge.type==='DRIVER_IDENTITY').verified,true);assert.equal(provider.trucks[0].driver_verification_badges.find(badge=>badge.type==='IDENTITY').verified,false);
   assert.equal(provider.trucks[0].truck_verification_badges.find(badge=>badge.type==='VEHICLE_OWNERSHIP').verified,false,'Profile badges use current authority');
   assert.equal(calls.filter(call=>call.path==='/rest/v1/rpc/public_person_identities').length,1,'Existing bounded identity batch remains the only identity read');assert.equal(calls.some(call=>call.path==='/rest/v1/profiles'||call.path==='/rest/v1/drivers'),false);
  });
 }
});
