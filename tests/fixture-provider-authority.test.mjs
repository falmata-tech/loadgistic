import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import {
  assertLocalAuthorityFixtureTarget,authorityFixtureStoragePath,prepareProviderAuthorityFixtures,
  fictionalOwnershipPdf,uploadAuthorityFixtureDocuments,confirmAuthorityFixtureReviews
} from '../scripts/fixture-provider-authority.mjs';

const url='http://127.0.0.1:55321';
const now='2026-10-14T12:00:00.000Z';
function sample(){
  return {document:{schema_version:1,fixture_source:'loadgistic',tables:{
    users:[{id:'user-admin',email:'admin@loadgistic.local',role:'ADMIN',active:1},
      {id:'owner-a',email:'a@loadgistic.local',role:'DRIVER',active:1},
      {id:'owner-b',email:'b@providers.loadgistic.test',role:'TRANSPORTER',active:1},
      {id:'employee',email:'employee@loadgistic.local',role:'DRIVER',active:1}],
    provider_profiles:[{id:'profile-a',user_id:'owner-a'}],
    memberships:[{id:'member-b',organization_id:'org-b',user_id:'owner-b',membership_role:'OWNER'}],
    vehicles:[{id:'truck-a',provider_profile_id:'profile-a',organization_id:null,active:1},
      {id:'truck-b',provider_profile_id:null,organization_id:'org-b',active:1},
      {id:'truck-c',provider_profile_id:null,organization_id:'org-b',active:1}],
    verification_requests:[{id:'source-a',subject_type:'VEHICLE',subject_id:'truck-a',verification_type:'VEHICLE_OWNERSHIP',status:'APPROVED',submitted_by:'owner-a',reviewed_by:'user-admin'},
      {id:'permission-b',subject_type:'VEHICLE',subject_id:'truck-b',verification_type:'VEHICLE_AUTHORIZATION',status:'APPROVED',submitted_by:'owner-b',reviewed_by:'user-admin'}]
  }},manifest:{schema_version:1,fixture_source:'loadgistic',fixture_admin_id:'user-admin',
    attestations:[{owner_user_id:'owner-a',vehicle_id:'truck-a',source_request_id:'source-a',source_kind:'EXISTING_OWNERSHIP',fact_kind:'OWNERSHIP'},
      {owner_user_id:'owner-b',vehicle_id:'truck-b',source_request_id:'fictional-source-b',source_kind:'FICTIONAL_OWNERSHIP',fact_kind:'OWNERSHIP'}],
    live_vehicle_ids:['truck-a','truck-b','truck-c']}};
}
function planFor(document,manifest){return prepareProviderAuthorityFixtures(document,manifest,{now});}
function mapUuid(value){return value===null||value===undefined?null:crypto.createHash('sha256').update(value).digest('hex').slice(0,8)+'-1111-4111-8111-111111111111';}
function fakeClient(plan,options={}){
  const calls=[],files=new Map();const admin=mapUuid('user-admin');
  const client={supabaseUrl:options.clientUrl||url,calls,files,
    auth:{admin:{getUserById:async id=>{calls.push(['auth',id]);return {data:{user:{id,app_metadata:{fixture_source:options.badAdmin?'another-app':'loadgistic'},user_metadata:{fixture_key:'user-admin'}}}};}}},
    from:table=>({select:fields=>({eq:(field,id)=>({maybeSingle:async()=>{
      calls.push(['profile',table,fields,field,id]);return {data:{id,role:options.badProfile?'SUPPORT':'ADMIN',active:true}};
    }})})}),
    storage:{from:bucket=>({upload:async(path,bytes,settings)=>{calls.push(['upload',bucket,path,settings]);files.set(path,bytes);return {};},
      download:async path=>{calls.push(['download',bucket,path]);return {data:new Blob([options.badFile?'not the uploaded document':files.get(path)])};}})},
    rpc:async(name,args)=>{
      calls.push(['rpc',name,args]);
      if(name==='managed_provider_authority_review_context'){
        const fact=plan.attestations.find(item=>mapUuid(item.source_request_id)===args.requested_request_ids[0]);
        const vehicle=plan.tables.vehicles.find(item=>item.id===fact.vehicle_id);
        return {data:[{requestId:mapUuid(fact.source_request_id),vehicleId:mapUuid(fact.vehicle_id),
          providerId:options.badContext?mapUuid('wrong-provider'):mapUuid(vehicle.organization_id||vehicle.provider_profile_id),
          providerKind:vehicle.organization_id?'ORGANIZATION':'PROVIDER_PROFILE',supportedFacts:['OWNERSHIP'],contextRevision:'a'.repeat(64)}]};
      }
      if(name==='confirm_provider_vehicle_authority')return {data:mapUuid('review-'+args.request_id)};
      if(name==='set_provider_vehicle_publication')return {data:{vehicleId:args.target_vehicle_id,state:'LIVE'}};
      if(name==='accept_content_policy')return {data:null};
      assert.fail(`Unexpected RPC ${name}`);
    }};
  assert.equal(admin,mapUuid(plan.adminId));return client;
}

test('authority seed is confined to the exact Loadgistic loopback port before credentials are used',()=>{
  for(const host of ['localhost','127.0.0.1','[::1]'])assert.equal(assertLocalAuthorityFixtureTarget(`http://${host}:55321`,{nodeEnv:'test'}),`http://${host}:55321`);
  for(const target of ['https://example.supabase.co','http://localhost:54321','http://127.0.0.1:55322',
    'https://localhost:55321',`${url}/other`,`${url}?target=other`,'http://user:password@localhost:55321',`${url}#other`]){
    assert.throws(()=>assertLocalAuthorityFixtureTarget(target,{nodeEnv:'test'}),/FIXTURE.*(?:INVALID|REFUSED)/);
  }
  assert.throws(()=>assertLocalAuthorityFixtureTarget(url,{nodeEnv:'production'}),/PRODUCTION_FIXTURE_IMPORT_REFUSED/);
});

test('fixture preparation requires source markers, named admin, local emails and an exhaustive explicit truck list',()=>{
  for(const mutate of [
    (d,m)=>{delete d.fixture_source;},(d,m)=>{m.fixture_source='another-app';},
    (d,m)=>{m.fixture_admin_id='owner-a';},(d,m)=>{d.tables.users[0].role='SUPPORT';},
    (d,m)=>{d.tables.users[1].email='customer@gmail.com';},
    (d,m)=>{m.live_vehicle_ids.pop();},(d,m)=>{m.live_vehicle_ids.push('truck-a');},
    (d,m)=>{m.attestations.pop();}
  ]){const {document,manifest}=sample();mutate(document,manifest);assert.throws(()=>planFor(document,manifest),/LOCAL_AUTHORITY_FIXTURE_/);}
});

test('only explicit exact ownership sources are reviewed; permission and unlisted trucks never acquire ownership',()=>{
  const {document,manifest}=sample();const before=structuredClone(document);
  const plan=planFor(document,manifest);
  assert.deepEqual(document,before);
  assert.equal(plan.tables.verification_requests.length,3);
  assert.deepEqual(plan.tables.verification_requests.find(row=>row.id==='permission-b'),before.tables.verification_requests[1]);
  assert.equal(plan.attestations.some(row=>row.vehicle_id==='truck-c'),false);
  assert.equal(plan.tables.vehicles.every(row=>row.publication_status==='DRAFT'),true);
  assert.equal(plan.tables.vehicles.some(row=>row.use_basis),false);
  assert.equal(plan.tables.users.find(row=>row.id==='owner-a').drives_truck,true);
  assert.equal(plan.tables.users.find(row=>row.id==='employee').drives_truck,false);
  assert.equal(plan.tables.users.find(row=>row.id==='owner-b').drives_truck,false);
  assert.match(plan.tables.verification_requests.find(row=>row.id==='fictional-source-b').review_note,/Fictional local test evidence/);
  for(const fact of plan.attestations)assert.equal(plan.tables.verification_requests.find(row=>row.id===fact.source_request_id).file_path,
    `supabase://verification/${authorityFixtureStoragePath(fact.source_request_id,fact.vehicle_id)}`);
  for(const change of [
    f=>{f.owner_user_id='owner-b';},f=>{f.vehicle_id='truck-c';},
    f=>{f.fact_kind='PERMISSION';},f=>{f.source_request_id='permission-b';}
  ]){const pair=sample();change(pair.manifest.attestations[0]);assert.throws(()=>planFor(pair.document,pair.manifest),/LOCAL_AUTHORITY_FIXTURE_/);}
});

test('the checked-in fixture manifest covers 30 known providers and 143 named trucks without inferring a permission upgrade',()=>{
  const document=JSON.parse(fs.readFileSync(new URL('../resources/fixtures/managed-market.json',import.meta.url)));
  const manifest=JSON.parse(fs.readFileSync(new URL('../resources/fixtures/provider-authority.json',import.meta.url)));
  const plan=planFor(document,manifest);
  assert.equal(plan.attestations.length,30);assert.equal(plan.liveVehicles.length,143);
  assert.equal(plan.attestations.filter(fact=>fact.source_kind==='EXISTING_OWNERSHIP').length,14);
  assert.equal(plan.attestations.filter(fact=>fact.source_kind==='FICTIONAL_OWNERSHIP').length,16);
  assert.equal(plan.tables.verification_requests.length,document.tables.verification_requests.length+16);
  for(const request of document.tables.verification_requests.filter(row=>row.verification_type==='VEHICLE_AUTHORIZATION')){
    assert.deepEqual(plan.tables.verification_requests.find(row=>row.id===request.id),request);
    assert.equal(plan.attestations.some(fact=>fact.source_request_id===request.id),false);
  }
});

test('every synthetic source has a unique valid PDF with an unmistakable fictional label',()=>{
  const pair=sample();const paths=new Set();
  for(const fact of pair.manifest.attestations){
    const bytes=fictionalOwnershipPdf(fact);const text=bytes.toString('ascii');
    assert.ok(text.startsWith('%PDF-1.4'));assert.match(text,/FICTIONAL LOCAL TEST EVIDENCE/);assert.match(text,/NOT LEGAL OWNERSHIP PROOF/);
    const xref=Number(text.match(/startxref\n(\d+)/)[1]);assert.equal(text.slice(xref,xref+4),'xref');
    paths.add(authorityFixtureStoragePath(fact.source_request_id,fact.vehicle_id));
  }
  assert.equal(paths.size,2);
});

test('no file or review operation is allowed for an arbitrary plan, wrong client or nonfixture administrator',async()=>{
  const pair=sample();const plan=planFor(pair.document,pair.manifest);
  for(const options of [{badAdmin:true},{badProfile:true},{clientUrl:'http://localhost:54321'}]){
    const client=fakeClient(plan,options);
    await assert.rejects(uploadAuthorityFixtureDocuments(client,url,plan,mapUuid),/LOCAL_AUTHORITY_FIXTURE_/);
    assert.equal(client.files.size,0);assert.equal(client.calls.some(call=>call[0]==='rpc'),false);
  }
  const client=fakeClient(plan);
  await assert.rejects(uploadAuthorityFixtureDocuments(client,url,{...plan},mapUuid),/MANIFEST_INVALID/);
  await assert.rejects(confirmAuthorityFixtureReviews(client,url,plan,mapUuid),/FILES_REQUIRED/);
  assert.equal(client.calls.some(call=>call[0]==='rpc'),false);
});

test('a private file must upload and download with matching bytes before any authority can be confirmed',async()=>{
  const pair=sample();const plan=planFor(pair.document,pair.manifest);const client=fakeClient(plan,{badFile:true});
  await assert.rejects(uploadAuthorityFixtureDocuments(client,url,plan,mapUuid),/FILE_VERIFY_FAILED/);
  await assert.rejects(confirmAuthorityFixtureReviews(client,url,plan,mapUuid),/FILES_REQUIRED/);
  assert.equal(client.calls.some(call=>call[0]==='rpc'),false);
});

test('normal review commands bind exact provider, truck, source and current revision before publication',async()=>{
  const pair=sample();const plan=planFor(pair.document,pair.manifest);const client=fakeClient(plan);
  await uploadAuthorityFixtureDocuments(client,url,plan,mapUuid);
  await confirmAuthorityFixtureReviews(client,url,plan,mapUuid);
  const rpc=client.calls.filter(call=>call[0]==='rpc');
  const reviews=rpc.filter(call=>call[1]==='confirm_provider_vehicle_authority');
  assert.equal(reviews.length,2);
  for(const [index,call] of reviews.entries())assert.deepEqual(call[2],{actor_user_id:mapUuid('user-admin'),request_id:mapUuid(plan.attestations[index].source_request_id),
    command:{fact_kind:'OWNERSHIP',holder_basis:null,expires_on:null,review_note:'Fictional local test evidence. No real ownership or operating authority is asserted.',context_revision:'a'.repeat(64)}});
  const publications=rpc.filter(call=>call[1]==='set_provider_vehicle_publication');
  assert.deepEqual(publications.map(call=>call[2]),plan.liveVehicles.map(vehicle=>({actor_user_id:mapUuid(vehicle.ownerId),target_vehicle_id:mapUuid(vehicle.vehicleId),requested_state:'LIVE'})));
  assert.ok(client.calls.findLastIndex(call=>call[0]==='download')<client.calls.findIndex(call=>call[1]==='confirm_provider_vehicle_authority'));
  assert.ok(rpc.findLastIndex(call=>call[1]==='confirm_provider_vehicle_authority')<rpc.findIndex(call=>call[1]==='set_provider_vehicle_publication'));
  assert.ok(rpc.findLastIndex(call=>call[1]==='accept_content_policy')<rpc.findIndex(call=>call[1]==='set_provider_vehicle_publication'));
});

test('a changed relationship context prevents review and all subsequent publication',async()=>{
  const pair=sample();const plan=planFor(pair.document,pair.manifest);const client=fakeClient(plan,{badContext:true});
  await uploadAuthorityFixtureDocuments(client,url,plan,mapUuid);
  await assert.rejects(confirmAuthorityFixtureReviews(client,url,plan,mapUuid),/CONTEXT_MISMATCH/);
  assert.equal(client.calls.some(call=>['confirm_provider_vehicle_authority','set_provider_vehicle_publication'].includes(call[1])),false);
});
