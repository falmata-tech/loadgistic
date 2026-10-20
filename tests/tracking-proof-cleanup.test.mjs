import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanupFixtureProofs,fixtureProofPaths} from './e2e/tracking-proof-cleanup.mjs';

function fixture(){
  const event={id:'event',shipment_id:'shipment',created_by:'actor',status:'LOADING',proof_mime_type:'image/png',
    proof_storage_path:'supabase://shipment-proof/tracking-proof/2026-10-20/12345678-1234-1234-1234-123456789abc.png'};
  return {actor:{id:'actor',provider_profile_id:'provider',email:'fixture-12345678@loadgistic.local'},vehicleId:'vehicle',
    shipment:{id:'shipment',created_by:'actor',provider_profile_id:'provider',provider_organization_id:null,assigned_vehicle_id:'vehicle',assigned_driver_user_id:'actor'},
    events:[event],references:[{id:event.id,shipment_id:event.shipment_id,proof_storage_path:event.proof_storage_path}]};
}

test('proof cleanup plans only the exact synthetic pair and private browser-upload PNGs',()=>{
  assert.deepEqual(fixtureProofPaths(fixture()),['tracking-proof/2026-10-20/12345678-1234-1234-1234-123456789abc.png']);
  const empty=fixture();empty.events=[];empty.references=[];assert.deepEqual(fixtureProofPaths(empty),[]);
});

test('proof cleanup rejects mismatched identity, owner, assigned vehicle or driver',()=>{
  for(const field of ['id','created_by','provider_profile_id','provider_organization_id','assigned_vehicle_id','assigned_driver_user_id']){
    const input=fixture();input.shipment[field]=field==='id'?'':'foreign';
    assert.throws(()=>fixtureProofPaths(input),/FIXTURE_SCOPE_REQUIRED/);
  }
  const real=fixture();real.actor.email='real@example.com';assert.throws(()=>fixtureProofPaths(real),/FIXTURE_SCOPE_REQUIRED/);
});

test('proof cleanup refuses unexpected events, storage namespaces, formats and duplicates',()=>{
  for(const [field,value] of [['id',''],['shipment_id','foreign'],['created_by','foreign'],['status','COMPLETED'],['proof_mime_type','application/pdf'],
    ['proof_storage_path','supabase://shipment-proof/tracking-proof/../../other.png'],['proof_storage_path','supabase://provider-profile/tracking-proof/2026-10-20/12345678-1234-1234-1234-123456789abc.png']]){
    const input=fixture();input.events[0][field]=value;assert.throws(()=>fixtureProofPaths(input),/EVENT_SCOPE_REQUIRED/);
  }
  const duplicate=fixture();duplicate.events.push({...duplicate.events[0]});assert.throws(()=>fixtureProofPaths(duplicate),/EVENT_SCOPE_REQUIRED/);
});

test('proof cleanup refuses missing or cross-shipment references before any removal',()=>{
  for(const change of [input=>input.references.push({...input.references[0],id:'foreign',shipment_id:'other'}),input=>input.references=[],input=>input.references[0].shipment_id='other']){
    const input=fixture();change(input);assert.throws(()=>fixtureProofPaths(input),/SHARED_REFERENCE/);
  }
});

test('proof cleanup refuses another local project before reading or deleting',async()=>{
  let accessed=false;
  for(const supabaseUrl of ['http://127.0.0.1:54321','https://hosted.example']){
    await assert.rejects(cleanupFixtureProofs({supabaseUrl,from(){accessed=true;}},{actor:{},vehicleId:'',shipmentId:''}),/LOCAL_LOADGISTIC_REQUIRED/);
  }
  assert.equal(accessed,false);
});
