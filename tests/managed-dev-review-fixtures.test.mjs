import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {existsSync,mkdtempSync,readFileSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {managedDevFixtureUuid,managedDevReviewFetch,prepareManagedDevReviewPlan,
  prepareManagedDevReviewFixtures} from '../scripts/prepare-managed-dev-review-fixtures.mjs';
import {productionProjectRef} from '../scripts/configure-managed-dev-supabase.mjs';
import {assertLocalAuthorityFixtureTarget} from '../scripts/fixture-provider-authority.mjs';

const document=JSON.parse(readFileSync(new URL('../resources/fixtures/managed-market.json',import.meta.url),'utf8'));
const developmentRef='abcdefghijklmnopqrst',branchId='11111111-1111-4111-8111-111111111111';
const manifest=()=>({version:1,scope:'loadgistic-managed-development',production_project_ref:productionProjectRef,
  development_project_ref:developmentRef,branch_id:branchId,branch_name:'loadgistic-development',
  verified_branch:{id:branchId,name:'loadgistic-development',project_ref:developmentRef,
    parent_project_ref:productionProjectRef,is_default:false,with_data:false}});
const credentials=()=>({development_project_ref:developmentRef,publishable_key:`sb_publishable_${'a'.repeat(40)}`,
  service_role_key:`sb_secret_${'b'.repeat(40)}`});
const plan=prepareManagedDevReviewPlan(document);
function migrationBuckets(){
  return ['shipment-proof','verification','capacity-photo','payment-proof','provider-profile','support-attachment','private-upload-quarantine']
    .map(id=>({id,name:id,public:false,file_size_limit:4194304,
      allowed_mime_types:['image/jpeg','image/png','image/webp',...(['capacity-photo','provider-profile'].includes(id)?[]:['application/pdf'])]}));
}

function fake({occupied=false,enabled=false,catalog=2,failTable=null,places=[],databaseClockOffset=0,hideSeedCapacity=false,
  buckets=migrationBuckets(),storageEntries={},bucketError=false,storageError=false}={}){
  const calls=[],users=[],saved=new Map();
  saved.set('place_catalog',structuredClone(places));
  const normalProviderId=randomUUID(),normalVehicleId=randomUUID();
  let databaseClock=Date.now()+databaseClockOffset;
  const read=table=>saved.get(table)||[];
  const status={enabled,catalog_version:catalog,last_dispatch_at:null,pending_count:0};
  const client={supabaseUrl:`https://${developmentRef}.supabase.co`,auth:{admin:{
    async listUsers(args){calls.push(['listUsers',args]);return {data:{users:occupied?[{id:randomUUID()}]:[]}};},
    async createUser(input){
      calls.push(['createUser',input]);assert.equal(input.email_confirm,true);
      const user={...input,id:randomUUID()};users.push(user);
      saved.set('profiles',[...read('profiles'),{id:user.id,role:'DRIVER',active:false}]);
      return {data:{user}};
    }
  }},storage:{
    async listBuckets(options){calls.push(['listBuckets',options]);return bucketError?{error:{message:'private provider detail'}}:{data:buckets};},
    from(bucket){return {async list(prefix,options){calls.push(['listStorageRoot',bucket,prefix,options]);
      assert.equal(prefix,'');assert.equal(options.limit,1);
      return storageError?{error:{message:'private file detail'}}:{data:storageEntries[bucket]||[]};
    }};}
  },from(table){
    let action='select',payload,filter,single=false;
    const query={
      select(){return query;},limit(){return query;},in(){return query;},
      eq(key,value){filter=[key,value];return query;},order(){return query;},
      maybeSingle(){single=true;return query;},
      insert(rows){action='insert';payload=rows;return query;},
      update(row){action='update';payload=row;return query;},
      then(resolve,reject){
        calls.push([action,table,payload]);
        if(action!=='select'&&table===failTable)return Promise.resolve({error:{message:'private remote details'}}).then(resolve,reject);
        if(action==='select'){
          let rows=filter?read(table).filter(row=>row[filter[0]]===filter[1]):read(table);
          if(single)rows=[...rows].sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));
          if(single&&hideSeedCapacity)rows=rows.filter(row=>row.market_status==='OFF_DUTY');
          return Promise.resolve({data:single?(rows[0]||null):rows}).then(resolve,reject);
        }
        if(action==='insert')saved.set(table,[...read(table),...payload.map(row=>table==='capacities'?{
          available_percent_reported_at:null,available_percent_reported_by:null,available_percent_reported_driver_id:null,
          updated_at:new Date(++databaseClock).toISOString(),...row}:row)]);
        if(action==='update')saved.set(table,read(table).map(row=>row[filter[0]]===filter[1]?{...row,...payload}:row));
        return Promise.resolve({data:null}).then(resolve,reject);
      }
    };return query;
  },async rpc(name,args){
    calls.push(['rpc',name,args]);
    if(name==='demo_world_status')return {data:status};
    if(name==='fleet_register_driver'){
      const employee=users.find(user=>user.id===args.target_user_id);
      assert.equal(employee.app_metadata.role,undefined);
      assert.equal(employee.app_metadata.provisioned_by,undefined);
      assert.equal(read('profiles').find(row=>row.id===employee.id).active,false);
    }
    if(name==='prepare_provider_signup_identity'){
      assert.deepEqual(Object.keys(args.command).sort(),['accountName','applicationType','businessName','drivesTruck',
        'firstName','handle','lastName','notes','phone'].sort());
      assert.match(args.requested_token_digest,/^[a-f0-9]{64}$/);
    }
    if(name==='complete_eligible_provider_signup')return {data:{providerProfileId:normalProviderId}};
    if(name==='create_provider_vehicle')return {data:{id:normalVehicleId}};
    if(name==='update_fleet_driver_access')saved.set('capacities',[...read('capacities'),{
      id:randomUUID(),vehicle_id:args.command.vehicle_id,market_status:'OFF_DUTY',available_percent:0,
      updated_at:new Date(++databaseClock).toISOString()}]);
    if(name==='capacity_owner_documents')return {data:[...args.organization_ids,...args.provider_ids]
      .map(id=>({subject_id:id,account_is_demo:id!==normalProviderId,documents:[]}))};
    return {data:{}};
  }};
  const definitions={};
  for(const [table,rows]of [['profiles',plan.demoUsers],['organizations',plan.organizations],
    ['provider_profiles',plan.providerProfiles],['company_pages',plan.pages],['vehicles',plan.vehicles],['capacities',plan.capacities]]){
    const properties=Object.fromEntries([...new Set(rows.flatMap(row=>Object.keys(row)))].map(key=>[key,
      key==='id'||key.endsWith('_id')||['updated_by'].includes(key)?{format:'uuid'}:
        ['active','drives_truck','verified','verified_identity','verified_license','vehicle_documents_verified','accepts_full_load',
          'accepts_partial_load','published','trailer_interchangeable'].includes(key)?{type:'boolean'}:
          key.endsWith('_json')?{format:'jsonb'}:{type:'string'}]));
    definitions[table]={properties};
  }
  Object.assign(definitions.profiles.properties,{full_name:{type:'string'},drives_truck:{type:'boolean'}});
  Object.assign(definitions.vehicles.properties,{publication_status:{type:'string'},use_basis:{type:'string'}});
  definitions.capacities.properties.available_percent_reported_at={type:'string'};
  const fetchImpl=async(url,options)=>{
    calls.push(['fetch',url,options]);
    assert.equal(options.redirect,'error');assert.ok(options.signal);
    if(url.endsWith('/auth/v1/settings'))return Response.json({external:{email:true}});
    if(url.includes('/platform_controls?'))return Response.json([{singleton:true}]);
    assert.equal(url,`https://${developmentRef}.supabase.co/rest/v1/`);
    return Response.json({definitions});
  };
  return {client,calls,users,saved,fetchImpl,clientFactory:(url,key,options)=>{
    assert.equal(options.db.retry,false);assert.equal(options.auth.persistSession,false);assert.equal(options.auth.autoRefreshToken,false);
    return client;
  }};
}
function setup(t){
  const directory=mkdtempSync(path.join(tmpdir(),'loadgistic-managed-review-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  return {manifest:manifest(),credentials:credentials(),document,receiptPath:path.join(directory,'receipt.json')};
}

test('review plan reuses the full fixture transforms before taking exact synthetic actors',()=>{
  const before=JSON.stringify(document);
  assert.deepEqual(plan.counts,{demoUsers:3,normalUsers:1,demoVehicles:2,normalVehicles:1,places:4});
  assert.deepEqual(plan.demoUsers.map(user=>user.id),['user-driver','user-public-fleet-01','user-public-fleet-driver-014']);
  assert.deepEqual(plan.sharing.map(row=>row.mode),['PRIVATE','PUBLIC']);
  assert.deepEqual(plan.places.map(row=>row.id).sort(),['builtin:addis ababa','builtin:sebeta','osm:node/6206220262','osm:node/837433823']);
  assert.equal(plan.places.find(row=>row.id==='osm:node/6206220262').place_type,'village');
  assert.equal(plan.places.find(row=>row.id==='osm:node/837433823').place_type,'neighbourhood');
  assert.ok(plan.vehicles.every(row=>row.publication_status==='DRAFT'));
  assert.equal(plan.providerProfiles[0].verified_identity,0);
  assert.equal(plan.providerProfiles[0].verified_license,0);
  assert.equal(plan.providerProfiles[0].vehicle_documents_verified,0);
  assert.equal(plan.workersActivated,false);assert.equal(plan.independentControlsInspected,false);
  assert.equal(plan.independentControlInspectionRequired,true);
  assert.equal(plan.storageRequired,false);assert.equal(plan.emailRequired,false);
  for(const capacity of plan.capacities){
    assert.equal(capacity.location_updated_at,document.tables.capacities.find(row=>row.id===capacity.id).location_updated_at);
  }
  assert.equal(JSON.stringify(document),before);
  assert.equal(managedDevFixtureUuid('veh-driver-1'),'2f22cc5a-d654-4405-98b7-9a1a9cf42fe3');
  assert.equal(managedDevFixtureUuid('veh-public-fleet-01-14'),'2020967a-92d3-4b1d-8f40-3c670dc97a50');
});

test('modified fixture role, identity and owner anchors are refused',()=>{
  for(const mutate of [
    value=>{value.tables.users.find(row=>row.id==='user-driver').role='ADMIN';},
    value=>{value.tables.users.find(row=>row.id==='user-driver').email='other@loadgistic.local';},
    value=>{value.tables.vehicles.find(row=>row.id==='veh-driver-1').provider_profile_id='other-provider';},
    value=>{value.tables.provider_profiles.find(row=>row.id==='provider-driver').user_id='other-user';}
  ]){const value=structuredClone(document);mutate(value);assert.throws(()=>prepareManagedDevReviewPlan(value));}
});

test('default hosted preflight reads only and requires no receipt file',async t=>{
  const options=setup(t),f=fake();
  const result=await prepareManagedDevReviewFixtures({...options,...f});
  assert.equal(result.applied,false);assert.equal(existsSync(options.receiptPath),false);
  assert.equal(result.workersActivated,false);assert.equal(result.independentControlsInspected,false);
  assert.equal(result.independentControlInspectionRequired,true);assert.equal(Object.hasOwn(result,'workersEnabled'),false);
  assert.deepEqual(result.baseline,{authUsersEmpty:true,coreBusinessTablesEmpty:['profiles','organizations','provider_profiles',
    'organization_members','vehicles','drivers','driver_vehicle_assignments','capacities','applications','provider_signup_intents','verification_requests'],
    storage:{bucketDefinitionsMatched:true,bucketsChecked:7,rootEntriesEmpty:true}});
  assert.equal(f.calls.filter(call=>call[0]==='listBuckets').length,1);
  assert.deepEqual(f.calls.find(call=>call[0]==='listBuckets')[1],{limit:8,offset:0,sortColumn:'id',sortOrder:'asc'});
  assert.equal(f.calls.filter(call=>call[0]==='listStorageRoot').length,7);
  assert.equal(f.calls.filter(call=>['insert','update','createUser'].includes(call[0])).length,0);
  assert.deepEqual(f.calls.filter(call=>call[0]==='rpc').map(call=>call[1]),['demo_world_status']);
  assert.equal(JSON.stringify(result).includes(options.credentials.service_role_key),false);
});

test('existing Storage objects or prefixes and unavailable reads fail before any fixture write or receipt',async t=>{
  for(const mode of [
    {storageEntries:{verification:[{id:randomUUID(),name:'private-file.pdf'}]}},
    {storageEntries:{'provider-profile':[{id:null,name:'private-prefix'}]}},
    {bucketError:true},{storageError:true}
  ]){
    const options=setup(t),f=fake(mode);
    await assert.rejects(prepareManagedDevReviewFixtures({...options,...f,applyToProject:developmentRef}),
      /^Error: MANAGED_DEV_REVIEW_STORAGE_(?:EMPTY_ROOTS_REQUIRED|BUCKET_CHECK_FAILED|ROOT_CHECK_FAILED)$/);
    assert.equal(f.calls.some(call=>['insert','update','createUser'].includes(call[0])),false);
    assert.equal(existsSync(options.receiptPath),false);
  }
});

test('Storage bucket definition drift is refused without modifying bucket definitions',async t=>{
  for(const mutate of [
    buckets=>buckets.pop(),buckets=>buckets.push({...buckets[0],id:'unknown-private-bucket',name:'unknown-private-bucket'}),
    buckets=>{buckets[0].public=true;},buckets=>{buckets[0].file_size_limit=10485760;},
    buckets=>{buckets[0].name='another-bucket';},buckets=>{buckets[0].allowed_mime_types.push('text/html');},
    buckets=>{buckets[0].type='ANALYTICS';},buckets=>{buckets[1]={...buckets[0]};},buckets=>{buckets[0]=null;}
  ]){
    const buckets=migrationBuckets();mutate(buckets);const before=JSON.stringify(buckets);
    const options=setup(t),f=fake({buckets});
    await assert.rejects(prepareManagedDevReviewFixtures({...options,...f,applyToProject:developmentRef}),/STORAGE_BUCKET_DEFINITION_DRIFT/);
    assert.equal(JSON.stringify(buckets),before);
    assert.equal(f.calls.some(call=>['insert','update','createUser','listStorageRoot'].includes(call[0])),false);
    assert.equal(existsSync(options.receiptPath),false);
  }
});

test('production, branch mismatch and missing explicit apply receipt fail before any API call',async()=>{
  for(const change of [
    options=>{options.nodeEnv='production';},options=>{options.manifest.development_project_ref=productionProjectRef;},
    options=>{options.manifest.verified_branch.with_data=true;},options=>{options.credentials.development_project_ref=productionProjectRef;},
    options=>{options.applyToProject='wrong-ref';},options=>{options.applyToProject=developmentRef;}
  ]){
    const options={manifest:manifest(),credentials:credentials(),document};change(options);
    await assert.rejects(prepareManagedDevReviewFixtures({...options,fetchImpl:()=>assert.fail('no API call'),
      clientFactory:()=>assert.fail('no client')}));
  }
  assert.throws(()=>assertLocalAuthorityFixtureTarget(`https://${developmentRef}.supabase.co`),/REMOTE_FIXTURE_IMPORT_REFUSED/);
});

test('occupied branches and active or wrong catalog controls fail before any mutation',async t=>{
  for(const mode of [{occupied:true},{enabled:true},{catalog:1}]){
    const options=setup(t),f=fake(mode);
    await assert.rejects(prepareManagedDevReviewFixtures({...options,...f,applyToProject:developmentRef}),
      /MANAGED_DEV_REVIEW_(?:EMPTY_BRANCH_REQUIRED|INERT_CATALOG_REQUIRED)/);
    assert.equal(f.calls.some(call=>['insert','update','createUser'].includes(call[0])),false);
    assert.equal(existsSync(options.receiptPath),false);
  }
});

test('explicit exact-project setup uses confirmed synthetic identities and ordinary lifecycle commands',async t=>{
  const options=setup(t),builtins=plan.places.filter(row=>row.id.startsWith('builtin:')),
    f=fake({places:builtins,databaseClockOffset:3600000});
  const result=await prepareManagedDevReviewFixtures({...options,...f,applyToProject:developmentRef});
  assert.equal(result.applied,true);assert.equal(result.browserWorkflowsChecked,false);
  assert.equal(result.workersActivated,false);assert.equal(result.independentControlsInspected,false);
  assert.equal(result.independentControlInspectionRequired,true);assert.equal(Object.hasOwn(result,'workersEnabled'),false);
  const receipt=JSON.parse(readFileSync(options.receiptPath,'utf8'));
  assert.equal(receipt.workersActivated,false);assert.equal(receipt.independentControlsInspected,false);
  assert.equal(receipt.independentControlInspectionRequired,true);assert.equal(Object.hasOwn(receipt,'workersEnabled'),false);
  assert.equal(statSync(options.receiptPath).mode&0o777,0o600);
  assert.equal(receipt.status,'PREPARED');assert.equal(receipt.users.length,3);
  assert.deepEqual(f.calls.find(call=>call[0]==='insert'&&call[1]==='place_catalog')[2].map(row=>row.id),
    plan.places.filter(row=>row.id.startsWith('osm:')).map(row=>row.id));
  assert.deepEqual(f.saved.get('place_catalog').filter(row=>row.id.startsWith('builtin:')),builtins);
  assert.ok(receipt.users.every(user=>user.password.length===32&&user.id));
  assert.equal(f.users.length,4);
  assert.equal(f.users.at(-1).app_metadata,undefined);
  assert.ok(f.users.slice(0,3).every(user=>user.app_metadata.fixture_source==='loadgistic'&&user.app_metadata.role===undefined));
  const commands=f.calls.filter(call=>call[0]==='rpc').map(call=>call[1]);
  assert.equal(commands.filter(name=>name==='fleet_register_driver').length,1);
  assert.equal(commands.filter(name=>name==='update_fleet_driver_access').length,3);
  assert.equal(commands.filter(name=>name==='set_provider_vehicle_publication').length,2);
  assert.equal(commands.filter(name=>name==='complete_eligible_provider_signup').length,1);
  assert.equal(commands.filter(name=>name==='create_provider_vehicle').length,1);
  assert.equal(commands.some(name=>/start|claim|configure_demo|report_demo|execute|advance/i.test(name)),false);
  assert.equal(f.calls.some(call=>['delete','upsert','inviteUserByEmail','signInWithOtp'].includes(call[0])),false);
  const tables=f.calls.filter(call=>call[0]==='insert').map(call=>call[1]);
  assert.equal(tables.includes('subscriptions'),false);assert.equal(tables.includes('verification_requests'),false);
  assert.equal(f.calls.some(call=>call[1]==='plans'),false);
  const capacities=f.saved.get('capacities').filter(row=>row.market_status==='PARTIAL');assert.equal(capacities.length,2);
  for(const capacity of capacities){
    assert.equal(capacity.location_updated_at,plan.capacities.find(row=>managedDevFixtureUuid(row.id)===capacity.id).location_updated_at);
    assert.equal(capacity.available_percent_reported_at,null);
    assert.ok(Date.parse(capacity.updated_at)>Date.now()+3500000);
  }
  const report=JSON.stringify(result);
  assert.equal(report.includes(receipt.normal.password),false);
  assert.equal(report.includes(receipt.users[0].password),false);
  assert.equal(report.includes(options.credentials.service_role_key),false);
});

test('a seed that is not the saved latest capacity never claims a prepared environment',async t=>{
  const options=setup(t),f=fake({hideSeedCapacity:true});
  await assert.rejects(prepareManagedDevReviewFixtures({...options,...f,applyToProject:developmentRef}),/CAPACITY_READBACK_FAILED/);
  const receipt=JSON.parse(readFileSync(options.receiptPath,'utf8'));
  assert.equal(receipt.status,'STOPPED_REVIEW_REQUIRED');assert.equal(receipt.normal,null);
});

test('catalog drift fails before the first remote fixture mutation and preserves a stopped receipt',async t=>{
  const options=setup(t),places=structuredClone(plan.places.filter(row=>row.id.startsWith('builtin:')));
  places[0].latitude+=0.01;const f=fake({places});
  await assert.rejects(prepareManagedDevReviewFixtures({...options,...f,applyToProject:developmentRef}),/EXISTING_PLACE_DRIFT/);
  assert.equal(f.calls.some(call=>['insert','update','createUser'].includes(call[0])),false);
  assert.equal(JSON.parse(readFileSync(options.receiptPath,'utf8')).status,'STOPPED_REVIEW_REQUIRED');
});

test('existing receipt prevents writes and a partial failure preserves exact IDs without retry or cleanup',async t=>{
  const options=setup(t),f=fake();writeFileSync(options.receiptPath,'keep-private',{mode:0o600});
  await assert.rejects(prepareManagedDevReviewFixtures({...options,...f,applyToProject:developmentRef}),/RECEIPT_ALREADY_EXISTS_OR_UNAVAILABLE/);
  assert.equal(readFileSync(options.receiptPath,'utf8'),'keep-private');
  assert.equal(f.users.length,0);
  rmSync(options.receiptPath);
  const broken=fake({failTable:'vehicles'});
  await assert.rejects(prepareManagedDevReviewFixtures({...options,...broken,applyToProject:developmentRef}),/^Error: MANAGED_DEV_REVIEW_FIXTURE_INSERT_FAILED$/);
  const receipt=JSON.parse(readFileSync(options.receiptPath,'utf8'));
  assert.equal(receipt.status,'STOPPED_REVIEW_REQUIRED');assert.equal(receipt.users.length,3);
  assert.equal(broken.calls.filter(call=>call[0]==='insert'&&call[1]==='vehicles').length,1);
  assert.equal(receipt.normal,null);
});

test('all SDK requests retain exact target, redirect refusal and finite timeout',async()=>{
  const calls=[],bounded=managedDevReviewFetch({url:`https://${developmentRef}.supabase.co`},async(...args)=>{calls.push(args);return Response.json({});});
  await bounded(`https://${developmentRef}.supabase.co/auth/v1/admin/users`,{method:'POST'});
  assert.equal(calls[0][1].redirect,'error');assert.ok(calls[0][1].signal);
  await assert.rejects(bounded(`https://${productionProjectRef}.supabase.co/rest/v1/profiles`),/REQUEST_TARGET_MISMATCH/);
  assert.equal(calls.length,1);
});

test('CLI has no reset, seed or implicit hosted apply and keeps failures sanitized',()=>{
  const script=fileURLToPath(new URL('../scripts/prepare-managed-dev-review-fixtures.mjs',import.meta.url));
  for(const argument of ['--reset-local','--seed','--apply']){
    const result=spawnSync(process.execPath,[script,argument],{encoding:'utf8'});
    assert.equal(result.status,1);assert.equal(result.stdout,'');assert.equal(result.stderr,'MANAGED_DEV_REVIEW_ARGUMENTS_INVALID\n');
  }
});
