// Separate, explicit fixture setup for a newly provisioned development branch.
// Never call the local reset/importer or change its loopback-only guards here.
// Baseline checks cover Auth, the named core business tables, the seven current
// private bucket definitions and empty Storage roots; not every database table.
import {createHash,randomBytes} from 'node:crypto';
import {constants,closeSync,fstatSync,ftruncateSync,openSync,readFileSync,writeSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {checkedManagedDevManifest,checkedManagedDevCredentials,checkManagedDevApi} from './configure-managed-dev-supabase.mjs';
import {assignFixtureDriverPortraits} from './fixture-driver-portraits.mjs';
import {applyManagedFixtureMarketPolicy,applyManagedFixtureVehicleCatalog,ensureIndependentVehicleAssignments,
  managedFixtureSharingPolicies} from './fixture-market-policy.mjs';
import {normalizePlace} from '../src/lib/route-matching.js';
import {normalizeProviderSignupInput} from '../src/lib/provider-signup.js';
import {contentPolicyVersion} from '../src/lib/privacy/content-policy.js';

const fail=code=>{throw new Error(`MANAGED_DEV_REVIEW_${code}`);};
const repositoryRoot=fileURLToPath(new URL('../',import.meta.url));
const settlementSource=JSON.parse(readFileSync(path.join(repositoryRoot,'resources/geo/ethiopia-settlements.json'),'utf8'));
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const demoUsers=['user-driver','user-public-fleet-01','user-public-fleet-driver-014'];
const demoVehicles=['veh-driver-1','veh-public-fleet-01-14'];
const emptyTables=['profiles','organizations','provider_profiles','organization_members','vehicles','drivers',
  'driver_vehicle_assignments','capacities','applications','provider_signup_intents','verification_requests'];
// Final migration-created definitions:001/009/029/032/048, with074's 4MiB limit.
// This helper reads and preserves them; missing/extra/changed buckets fail closed.
const storageBucketIds=['shipment-proof','verification','capacity-photo','payment-proof','provider-profile',
  'support-attachment','private-upload-quarantine'];
const fields={
  profiles:['id','email','phone','full_name','role','active','drives_truck','driver_portrait_preset'],
  organizations:['id','name','handle','type','verified','description','city','city_place_ref','city_lat','city_lng','public_visibility'],
  provider_profiles:['id','user_id','business_name','handle','verified_identity','verified_license','vehicle_documents_verified',
    'vehicle_type','city','city_place_ref','city_lat','city_lng','about','public_visibility'],
  vehicles:['id','organization_id','provider_profile_id','platform_number','label','category','plate','active','make','model',
    'cargo_configuration','trailer_interchangeable','supported_trailer_configurations','publication_status','use_basis'],
  company_pages:['id','organization_id','provider_profile_id','headline','about','services','published','base_region_code','account_name'],
  capacities:['id','provider_organization_id','provider_profile_id','vehicle_id','status','market_status','available_percent',
    'origin','destination','corridor','visibility','location_lat','location_lng','location_precision_km','location_source',
    'updated_by','updated_at','expires_at','movement_scope','local_place_ref','local_place_label','local_center_lat','local_center_lng',
    'local_radius_km','availability_geometry','work_radius_km','location_area','location_updated_at','location_place_ref',
    'accepts_full_load','accepts_partial_load','open_to_contract_lanes','accepts_multi_stop','accepts_multi_pick','accepts_multi_drop',
    'current_route_origin','current_route_destination','current_origin_place_ref','current_origin_lat','current_origin_lng',
    'current_destination_place_ref','current_destination_lat','current_destination_lng','origin_place_ref','origin_lat','origin_lng',
    'destination_place_ref','destination_lat','destination_lng','current_route_points_json','capacity_area_center_place_ref',
    'capacity_area_center_label','capacity_area_center_lat','capacity_area_center_lng','capacity_area_boundary_json']
};

// The same deterministic identity namespace as the existing local importer.
export function managedDevFixtureUuid(value){
  if(value===null||value===undefined||value==='')return null;
  if(uuid.test(String(value)))return String(value);
  const bytes=createHash('sha256').update(`loadgistic-fixture:${value}`).digest().subarray(0,16);
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=bytes.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export function prepareManagedDevReviewPlan(document,{now=new Date()}={}){
  if(document?.fixture_source!=='loadgistic'||document.schema_version!==1||!document.tables
    ||!Number.isFinite(now.getTime()))fail('FIXTURE_DOCUMENT_INVALID');
  const source=structuredClone(document.tables);
  source.users=assignFixtureDriverPortraits(source.users);
  source.driver_vehicle_assignments=ensureIndependentVehicleAssignments(source.vehicles,source.provider_profiles,
    source.driver_vehicle_assignments,{assignedAt:now.toISOString()});
  // Full-set transforms preserve the existing catalog and sharing decisions.
  source.vehicles=applyManagedFixtureVehicleCatalog(source.vehicles,source.driver_vehicle_assignments,source.users);
  source.capacities=applyManagedFixtureMarketPolicy(source.capacities,source.vehicles);
  const select=(table,ids)=>ids.map(id=>{
    const rows=source[table].filter(row=>row.id===id);
    if(rows.length!==1)fail('FIXTURE_SOURCE_MISMATCH');return rows[0];
  });
  const users=select('users',demoUsers);
  const identities=[['driver@loadgistic.local','DRIVER'],['owner-01@providers.loadgistic.test','TRANSPORTER'],
    ['driver-014@providers.loadgistic.test','DRIVER']];
  if(users.some((user,index)=>user.email!==identities[index][0]||user.role!==identities[index][1]||Number(user.active)!==1))fail('FIXTURE_SOURCE_MISMATCH');
  const vehicles=select('vehicles',demoVehicles).map(row=>({...row,publication_status:'DRAFT',use_basis:'OWNED'}));
  if(vehicles[0].provider_profile_id!=='provider-driver'||vehicles[0].organization_id!==null
    ||vehicles[1].organization_id!=='org-public-fleet-01'||vehicles[1].provider_profile_id!==null)fail('FIXTURE_SOURCE_MISMATCH');
  const capacities=demoVehicles.map(id=>{
    const rows=source.capacities.filter(row=>row.vehicle_id===id);
    if(rows.length!==1)fail('FIXTURE_SOURCE_MISMATCH');return {...rows[0],accepts_full_load:0,accepts_partial_load:1};
  });
  const sharing=managedFixtureSharingPolicies(capacities,new Set());
  if(sharing[0].mode!=='PRIVATE'||sharing[1].mode!=='PUBLIC')fail('FIXTURE_SHARING_DRIFT');
  const organizations=select('organizations',['org-public-fleet-01']).map(row=>({...row,verified:0}));
  const providerProfiles=select('provider_profiles',['provider-driver']).map(row=>({...row,
    verified_identity:0,verified_license:0,vehicle_documents_verified:0}));
  if(providerProfiles[0].user_id!=='user-driver')fail('FIXTURE_SOURCE_MISMATCH');
  const pages=select('company_pages',['page-driver','page-public-fleet-01']);
  const places=new Map();
  const addPlace=(id,name,latitude,longitude)=>{
    if(typeof id!=='string'||!id||!Number.isFinite(latitude)||!Number.isFinite(longitude))fail('FIXTURE_PLACE_INVALID');
    const osm=id.match(/^osm:(node|way|relation)\/(\d+)$/);
    if(!osm&&!id.startsWith('builtin:'))fail('FIXTURE_PLACE_INVALID');
    const settlement=osm?settlementSource.elements.find(element=>element.type===osm[1]&&String(element.id)===osm[2]):null;
    if(osm&&(!settlement||settlement.lat!==latitude||settlement.lon!==longitude
      ||settlement.tags?.['name:en']!==String(name).replace(/,\s*Ethiopia$/i,'')))fail('FIXTURE_PLACE_DRIFT');
    const row={id,name:String(name).replace(/,\s*Ethiopia$/i,''),normalized_name:normalizePlace(name.replace(/,\s*Ethiopia$/i,'')),
      alternate_names:settlement?.tags?.name||'',place_type:settlement?.tags?.place||'city',latitude,longitude,source:osm?'OPENSTREETMAP_OVERPASS':'BUILT_IN',
      osm_type:osm?.[1]||null,osm_id:osm?.[2]||null,country_name:'Ethiopia',country_code:'ET'};
    const existing=places.get(id);
    if(existing&&(existing.latitude!==latitude||existing.longitude!==longitude))fail('FIXTURE_PLACE_DRIFT');
    places.set(id,row);
  };
  for(const row of [...organizations,...providerProfiles])addPlace(row.city_place_ref,row.city,Number(row.city_lat),Number(row.city_lng));
  for(const row of capacities){
    for(const point of JSON.parse(row.current_route_points_json))addPlace(point.place_ref,point.label,Number(point.lat),Number(point.lng));
  }
  return {version:1,demoUsers:users,organizations,providerProfiles,pages,vehicles,capacities,sharing,
    places:[...places.values()],counts:{demoUsers:3,normalUsers:1,demoVehicles:2,normalVehicles:1,places:places.size},
    workersActivated:false,independentControlsInspected:false,independentControlInspectionRequired:true,
    emailRequired:false,storageRequired:false};
}

function privateJson(filename){
  let fd;
  try{fd=openSync(filename,constants.O_RDONLY|constants.O_NOFOLLOW);const stat=fstatSync(fd);
    if(!stat.isFile()||stat.nlink!==1||(stat.mode&0o077)!==0
      ||typeof process.getuid==='function'&&stat.uid!==process.getuid())fail('PRIVATE_FILE_REQUIRED');
    return JSON.parse(readFileSync(fd,'utf8'));
  }catch(error){if(error.message==='MANAGED_DEV_REVIEW_PRIVATE_FILE_REQUIRED')throw error;fail('INPUT_FILE_UNAVAILABLE');}
  finally{if(fd!==undefined)closeSync(fd);}
}

export function managedDevReviewFetch(target,fetchImpl=fetch){
  return async(input,init={})=>{
    let url;try{url=new URL(typeof input==='string'?input:input.url||input);}catch{fail('REQUEST_TARGET_INVALID');}
    if(url.origin!==target.url||url.username||url.password)fail('REQUEST_TARGET_MISMATCH');
    // SDK Auth calls also have a finite deadline and cannot follow redirects.
    return fetchImpl(input,{...init,redirect:'error',signal:AbortSignal.timeout(10000)});
  };
}

async function checked(operation,code){
  let result;try{result=await operation;}catch{fail(code);}
  if(result?.error)fail(code);return result?.data;
}
async function rpc(client,name,args,code){return checked(client.rpc(name,args),code);}
async function latestCapacity(client,vehicleId){
  return checked(client.from('capacities').select('id,vehicle_id,market_status,available_percent,updated_at,expires_at,location_updated_at,available_percent_reported_at,available_percent_reported_by,available_percent_reported_driver_id')
    .eq('vehicle_id',vehicleId).order('updated_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle(),'CAPACITY_READ_FAILED');
}
async function storageBaseline(client){
  const buckets=await checked(client.storage.listBuckets({limit:storageBucketIds.length+1,offset:0,
    sortColumn:'id',sortOrder:'asc'}),'STORAGE_BUCKET_CHECK_FAILED');
  if(!Array.isArray(buckets)||buckets.length!==storageBucketIds.length
    ||buckets.some(bucket=>!bucket||typeof bucket!=='object'||typeof bucket.id!=='string')
    ||new Set(buckets.map(bucket=>bucket?.id)).size!==storageBucketIds.length)fail('STORAGE_BUCKET_DEFINITION_DRIFT');
  for(const bucket of buckets){
    const imagesOnly=['capacity-photo','provider-profile'].includes(bucket.id);
    const expectedMimes=['image/jpeg','image/png','image/webp',...(imagesOnly?[]:['application/pdf'])].sort();
    if(!storageBucketIds.includes(bucket.id)||bucket.name!==bucket.id||bucket.public!==false
      ||bucket.type!==undefined&&bucket.type!=='STANDARD'||bucket.file_size_limit!==4194304
      ||!Array.isArray(bucket.allowed_mime_types)||bucket.allowed_mime_types.some(value=>typeof value!=='string')
      ||JSON.stringify([...bucket.allowed_mime_types].sort())!==JSON.stringify(expectedMimes))fail('STORAGE_BUCKET_DEFINITION_DRIFT');
  }
  const roots=await Promise.all(buckets.map(bucket=>checked(client.storage.from(bucket.id)
    .list('',{limit:1,offset:0,sortBy:{column:'name',order:'asc'}}),'STORAGE_ROOT_CHECK_FAILED')));
  // Both files and prefix/folder entries make the selected baseline occupied.
  if(roots.some(rows=>!Array.isArray(rows)||rows.length!==0))fail('STORAGE_EMPTY_ROOTS_REQUIRED');
  return {bucketDefinitionsMatched:true,bucketsChecked:buckets.length,rootEntriesEmpty:true};
}

async function preflight(client,target,credentials,fetchImpl){
  await checkManagedDevApi(target,credentials,{fetchImpl});
  const listed=await checked(client.auth.admin.listUsers({page:1,perPage:1}),'AUTH_CHECK_FAILED');
  if(!Array.isArray(listed?.users)||listed.users.length)fail('EMPTY_BRANCH_REQUIRED');
  for(const table of emptyTables){
    const rows=await checked(client.from(table).select('id').limit(1),'EMPTY_BRANCH_CHECK_FAILED');
    if(!Array.isArray(rows)||rows.length)fail('EMPTY_BRANCH_REQUIRED');
  }
  const storage=await storageBaseline(client);
  const status=await rpc(client,'demo_world_status',{},'CATALOG_CHECK_FAILED');
  if(status?.enabled!==false||status.catalog_version!==2||status.last_dispatch_at!==null
    ||status.pending_count!==0)fail('INERT_CATALOG_REQUIRED');
  let response;
  try{response=await fetchImpl(`${target.url}/rest/v1/`,{method:'GET',headers:{apikey:credentials.serviceRoleKey,
    authorization:`Bearer ${credentials.serviceRoleKey}`}});}catch{fail('SCHEMA_READ_FAILED');}
  if(!response.ok)fail('SCHEMA_READ_FAILED');
  let schema;try{schema=await response.json();}catch{fail('SCHEMA_READ_FAILED');}
  const definitions=schema.definitions||schema.components?.schemas;
  if(!definitions?.vehicles?.properties?.publication_status||!definitions.profiles?.properties?.drives_truck
    ||!definitions.capacities?.properties?.available_percent_reported_at)fail('CURRENT_SCHEMA_REQUIRED');
  return {definitions,baseline:{authUsersEmpty:true,coreBusinessTablesEmpty:[...emptyTables],storage}};
}

function project(table,row,definitions,userIds){
  const properties=definitions[table]?.properties;
  if(!properties)fail('CURRENT_SCHEMA_REQUIRED');
  return Object.fromEntries(fields[table].filter(key=>row[key]!==undefined&&properties[key]).map(key=>{
    const property=properties[key];let value=row[key];
    if(value!==null){
      if(property.format==='uuid')value=userIds.get(value)||managedDevFixtureUuid(value);
      else if(property.type==='boolean'||property.format==='boolean')value=Boolean(Number(value));
      else if(['json','jsonb'].includes(property.format)&&typeof value==='string')value=JSON.parse(value);
    }
    return [key,value];
  }));
}

// A remote caller must separately approve the exact project, provide protected
// branch-only credentials, and select a new private receipt. No reset/retry exists.
// Before apply, the operator must separately inspect the exact development
// branch's private independent controls through the approved read-only provider
// path. This service-key helper cannot read them and accepts no waiver flag.
export async function prepareManagedDevReviewFixtures({manifest,credentials,applyToProject=null,receiptPath,
  document=JSON.parse(readFileSync(path.join(repositoryRoot,'resources/fixtures/managed-market.json'),'utf8')),
  clientFactory=createClient,fetchImpl=fetch,nodeEnv=process.env.NODE_ENV}={}){
  if(nodeEnv==='production')fail('PRODUCTION_RUNTIME_REFUSED');
  const target=checkedManagedDevManifest(manifest),keys=checkedManagedDevCredentials(credentials,target);
  if(applyToProject!==null&&applyToProject!==target.projectRef)fail('APPLY_TARGET_MISMATCH');
  if(applyToProject!==null&&!receiptPath)fail('RECEIPT_PATH_REQUIRED');
  const plan=prepareManagedDevReviewPlan(document);
  const boundedFetch=managedDevReviewFetch(target,fetchImpl);
  const client=clientFactory(target.url,keys.serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false},
    db:{retry:false},global:{fetch:boundedFetch}});
  if(client.supabaseUrl?.replace(/\/$/,'')!==target.url)fail('CLIENT_TARGET_MISMATCH');
  const {definitions,baseline}=await preflight(client,target,keys,boundedFetch);
  if(applyToProject===null)return {projectRef:target.projectRef,branchId:target.branchId,applied:false,...plan.counts,
    baseline,workersActivated:false,independentControlsInspected:false,independentControlInspectionRequired:true,
    emailRequired:false,storageRequired:false,browserWorkflowsChecked:false};
  let receiptFd;
  try{receiptFd=openSync(receiptPath,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);}
  catch{fail('RECEIPT_ALREADY_EXISTS_OR_UNAVAILABLE');}
  const receipt={version:1,purpose:'loadgistic-managed-development-review',projectRef:target.projectRef,branchId:target.branchId,
    status:'PREPARING',workersActivated:false,independentControlsInspected:false,independentControlInspectionRequired:true,
    users:[],vehicles:demoVehicles.map(managedDevFixtureUuid),normal:null,
    fixtureIds:{organization:managedDevFixtureUuid('org-public-fleet-01'),providerProfile:managedDevFixtureUuid('provider-driver'),
      pages:plan.pages.map(row=>managedDevFixtureUuid(row.id)),capacitySnapshots:plan.capacities.map(row=>managedDevFixtureUuid(row.id)),
      places:plan.places.map(row=>row.id)}};
  const save=()=>{ftruncateSync(receiptFd,0);writeSync(receiptFd,JSON.stringify(receipt,null,2)+'\n',0,'utf8');};
  const userIds=new Map();
  const insert=async(table,rows)=>{
    if(rows.length)await checked(client.from(table).insert(rows),'FIXTURE_INSERT_FAILED');
  };
  try{
    save();
    const existing=await checked(client.from('place_catalog').select('id,name,latitude,longitude,country_code')
      .in('id',plan.places.map(row=>row.id)),'PLACE_CHECK_FAILED');
    if(!Array.isArray(existing)||new Set(existing.map(row=>row.id)).size!==existing.length)fail('PLACE_CHECK_FAILED');
    const existingById=new Map(existing.map(row=>[row.id,row]));
    for(const row of existing){
      const expected=plan.places.find(place=>place.id===row.id);
      if(!expected||row.name!==expected.name||Number(row.latitude)!==expected.latitude
        ||Number(row.longitude)!==expected.longitude||row.country_code!=='ET')fail('EXISTING_PLACE_DRIFT');
    }
    // Schema migrations already install built-ins. Preserve matching catalog
    // facts, and add only this selected fixture's missing reference places.
    await insert('place_catalog',plan.places.filter(row=>!existingById.has(row.id)));
    for(const user of plan.demoUsers){
      const password=randomBytes(24).toString('base64url');
      receipt.users.push({fixtureKey:user.id,email:user.email,password,id:null});save();
      const created=await checked(client.auth.admin.createUser({email:user.email,password,email_confirm:true,
        user_metadata:{full_name:user.name,fixture_key:user.id},app_metadata:{fixture_source:'loadgistic'}}),'AUTH_CREATE_FAILED');
      if(!uuid.test(created?.user?.id||''))fail('AUTH_CREATE_FAILED');
      userIds.set(user.id,created.user.id);receipt.users.at(-1).id=created.user.id;save();
      // Leave the employed driver's pristine bootstrap for fleet_register_driver.
      if(user.id==='user-public-fleet-driver-014')continue;
      const profile=project('profiles',{...user,id:created.user.id,full_name:user.name,
        drives_truck:user.id==='user-driver'},definitions,userIds);
      await checked(client.from('profiles').update(profile).eq('id',created.user.id),'PROFILE_SETUP_FAILED');
    }
    await insert('organizations',plan.organizations.map(row=>project('organizations',row,definitions,userIds)));
    await insert('provider_profiles',plan.providerProfiles.map(row=>project('provider_profiles',row,definitions,userIds)));
    await insert('organization_members',[{organization_id:managedDevFixtureUuid('org-public-fleet-01'),
      user_id:userIds.get('user-public-fleet-01'),membership_role:'OWNER'}]);
    await insert('company_pages',plan.pages.map(row=>project('company_pages',row,definitions,userIds)));
    await insert('vehicles',plan.vehicles.map(row=>project('vehicles',row,definitions,userIds)));
    const employee=plan.demoUsers[2];
    await rpc(client,'fleet_register_driver',{actor_user_id:userIds.get('user-public-fleet-01'),
      target_user_id:userIds.get(employee.id),command:{email:employee.email,name:employee.name,phone:'+251900000001'}},'DRIVER_REGISTRATION_FAILED');
    for(const [owner,driver,vehicle]of[['user-driver','user-driver',demoVehicles[0]],
      ['user-public-fleet-01',employee.id,demoVehicles[1]]]){
      await rpc(client,'update_fleet_driver_access',{actor_user_id:userIds.get(owner),command:{driver_user_id:userIds.get(driver),
        vehicle_id:managedDevFixtureUuid(vehicle),can_manage_capacity:true,can_manage_tracking:true}},'ASSIGNMENT_FAILED');
      await rpc(client,'accept_content_policy',{actor_user_id:userIds.get(owner),policy_version:contentPolicyVersion},'POLICY_FAILED');
      await rpc(client,'set_provider_vehicle_publication',{actor_user_id:userIds.get(owner),
        target_vehicle_id:managedDevFixtureUuid(vehicle),requested_state:'LIVE'},'PUBLICATION_FAILED');
    }
    // Preserve the original dated location reports. This records synthetic seed
    // capacity after assignment; it creates no phone/GPS source or fresh fix.
    const assignmentResets=await Promise.all(plan.capacities.map(row=>latestCapacity(client,managedDevFixtureUuid(row.vehicle_id))));
    if(assignmentResets.some(row=>row?.market_status!=='OFF_DUTY'||!Number.isFinite(Date.parse(row.updated_at))))fail('ASSIGNMENT_READBACK_FAILED');
    // The installed database default supplies updated_at after the assignment
    // transaction, including when the development host's clock differs.
    await insert('capacities',plan.capacities.map((row,index)=>project('capacities',{...row,updated_at:undefined,
      expires_at:new Date(Date.parse(assignmentResets[index].updated_at)+86400000).toISOString()},definitions,userIds)));
    const savedCapacities=await Promise.all(plan.capacities.map(row=>latestCapacity(client,managedDevFixtureUuid(row.vehicle_id))));
    for(const [index,saved]of savedCapacities.entries()){
      const expected=plan.capacities[index];
      if(saved?.id!==managedDevFixtureUuid(expected.id)||saved.market_status!=='PARTIAL'
        ||saved.available_percent!==expected.available_percent||Date.parse(saved.updated_at)<=Date.parse(assignmentResets[index].updated_at)
        ||!Number.isFinite(Date.parse(saved.updated_at))||!Number.isFinite(Date.parse(saved.expires_at))
        ||Date.parse(saved.expires_at)<=Date.parse(saved.updated_at)
        ||saved.location_updated_at!==expected.location_updated_at||saved.available_percent_reported_at!==null
        ||saved.available_percent_reported_by!==null||saved.available_percent_reported_driver_id!==null)fail('CAPACITY_READBACK_FAILED');
    }
    await insert('vehicle_capacity_sharing',plan.sharing.map(row=>({...row,vehicle_id:managedDevFixtureUuid(row.vehicle_id)})));
    const normalEmail=`normal-review-${randomBytes(8).toString('hex')}@example.test`,normalPassword=randomBytes(24).toString('base64url');
    receipt.normal={email:normalEmail,password:normalPassword,id:null,providerProfileId:null,vehicleId:null};save();
    const normal=await checked(client.auth.admin.createUser({email:normalEmail,password:normalPassword,email_confirm:true,
      user_metadata:{full_name:'Normal review provider'}}),'NORMAL_AUTH_CREATE_FAILED');
    if(!uuid.test(normal?.user?.id||''))fail('NORMAL_AUTH_CREATE_FAILED');
    receipt.normal.id=normal.user.id;save();
    const signup=normalizeProviderSignupInput({accountName:'Normal review provider',handle:`normal-review-${randomBytes(6).toString('hex')}`,
      firstName:'Normal',lastName:'Review',phone:'+251900000002',applicationType:'TRANSPORT_PROVIDER',drivesTruck:true});
    if(!signup.ok)fail('NORMAL_SIGNUP_INPUT_FAILED');
    const digest=randomBytes(32).toString('hex');
    await rpc(client,'accept_content_policy',{actor_user_id:normal.user.id,policy_version:contentPolicyVersion},'NORMAL_POLICY_FAILED');
    const {accountName,handle,firstName,lastName,businessName,phone,applicationType,notes,drivesTruck}=signup.input;
    await rpc(client,'prepare_provider_signup_identity',{requested_token_digest:digest,
      command:{accountName,handle,firstName,lastName,businessName,phone,applicationType,notes,drivesTruck},
      requested_expires_at:new Date(Date.now()+900000).toISOString()},'NORMAL_SIGNUP_PREPARE_FAILED');
    const completed=await rpc(client,'complete_eligible_provider_signup',{actor_user_id:normal.user.id,
      requested_token_digest:digest},'NORMAL_SIGNUP_FAILED');
    if(!uuid.test(completed?.providerProfileId||''))fail('NORMAL_SIGNUP_FAILED');
    receipt.normal.providerProfileId=completed.providerProfileId;save();
    const truck=await rpc(client,'create_provider_vehicle',{actor_user_id:normal.user.id,command:{make:'Synthetic',model:'Review',
      plate:'DEV-NORMAL-001',cargo_configuration:'Cargo van',use_basis:'OWNED'}},'NORMAL_VEHICLE_FAILED');
    if(!uuid.test(truck?.id||''))fail('NORMAL_VEHICLE_FAILED');
    receipt.normal.vehicleId=truck.id;save();
    await rpc(client,'update_fleet_driver_access',{actor_user_id:normal.user.id,command:{driver_user_id:normal.user.id,
      vehicle_id:truck.id,can_manage_capacity:true,can_manage_tracking:true}},'NORMAL_ASSIGNMENT_FAILED');
    const provenance=await rpc(client,'capacity_owner_documents',{organization_ids:[managedDevFixtureUuid('org-public-fleet-01')],
      provider_ids:[managedDevFixtureUuid('provider-driver'),completed.providerProfileId]},'PROVENANCE_CHECK_FAILED');
    if(!Array.isArray(provenance)||provenance.length!==3||provenance.some(row=>row.account_is_demo!==
      (row.subject_id!==completed.providerProfileId)))fail('PROVENANCE_CHECK_FAILED');
    const status=await rpc(client,'demo_world_status',{},'CATALOG_CHECK_FAILED');
    if(status?.enabled!==false||status.catalog_version!==2||status.last_dispatch_at!==null||status.pending_count!==0)fail('INERT_CATALOG_REQUIRED');
    receipt.status='PREPARED';save();
    return {projectRef:target.projectRef,branchId:target.branchId,applied:true,...plan.counts,baseline,workersActivated:false,
      independentControlsInspected:false,independentControlInspectionRequired:true,
      emailRequired:false,storageRequired:false,browserWorkflowsChecked:false};
  }catch(error){receipt.status='STOPPED_REVIEW_REQUIRED';save();throw error;}
  finally{closeSync(receiptFd);}
}

async function main(){
  const options={},args=process.argv.slice(2);
  for(let index=0;index<args.length;index++){
    const key={'--manifest':'manifestPath','--credentials':'credentialsPath','--apply-to-project':'applyToProject','--receipt':'receiptPath'}[args[index]];
    if(!key||options[key]||!args[index+1]||args[index+1].startsWith('--'))fail('ARGUMENTS_INVALID');
    options[key]=args[++index];
  }
  if(!options.manifestPath||!options.credentialsPath)fail('INPUT_PATHS_REQUIRED');
  const result=await prepareManagedDevReviewFixtures({...options,manifest:privateJson(options.manifestPath),credentials:privateJson(options.credentialsPath)});
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{
  process.stderr.write(`${/^MANAGED_DEV_(?:REVIEW_)?[A-Z_]+$/.test(error?.message||'')?error.message:'MANAGED_DEV_REVIEW_SETUP_FAILED'}\n`);
  process.exitCode=1;
});
