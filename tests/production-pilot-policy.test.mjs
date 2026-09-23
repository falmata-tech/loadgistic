import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {readPrivateUpload} from '../src/lib/private-storage.js';
import {
  PRODUCTION_PILOT_SOURCE,pilotEmail,pilotUuid,validateProductionPilotTarget
} from '../scripts/production-pilot-policy.mjs';

test('Production pilot identities are namespaced, non-deliverable, and deterministic',()=>{
  assert.equal(PRODUCTION_PILOT_SOURCE,'loadgistic-production-pilot-v1');
  assert.equal(pilotUuid('vehicle-1'),pilotUuid('vehicle-1'));
  assert.notEqual(pilotUuid('vehicle-1'),pilotUuid('vehicle-2'));
  assert.match(pilotEmail('user-driver-1'),/^pilot-[a-z0-9-]+@pilot\.loadgistic\.test$/);
  assert.doesNotMatch(pilotEmail('user-driver-1'),/@gmail\.com$|@loadgistic\.local$/);
});

test('a repeat pilot import preserves the current email of the exact tagged identity',()=>{
  const identity={email:'owner+demo@example.com',app_metadata:{fixture_source:PRODUCTION_PILOT_SOURCE,role:'DRIVER'},user_metadata:{fixture_key:'user-driver-1'}};
  assert.equal(pilotEmail('user-driver-1',identity),'owner+demo@example.com');
  assert.throws(()=>pilotEmail('other-driver',identity),/IDENTITY_MISMATCH/);
  assert.throws(()=>pilotEmail('user-driver-1',{...identity,app_metadata:{...identity.app_metadata,fixture_source:'real-account'}}),/IDENTITY_MISMATCH/);
  assert.throws(()=>pilotEmail('user-driver-1',{...identity,app_metadata:{...identity.app_metadata,role:'ADMIN'}}),/IDENTITY_MISMATCH/);
  assert.throws(()=>pilotEmail('user-driver-1',{...identity,email:'not-an-email'}),/IDENTITY_MISMATCH/);
  const source=fs.readFileSync('scripts/import-production-pilot.mjs','utf8');
  assert.match(source,/value=pilotEmail\(row.id,existingPilotUsers.get\(row.id\)\)/);
});

test('the hosted importer is additive and keeps destructive local reset and reusable credentials out',()=>{
  const source=fs.readFileSync('scripts/import-production-pilot.mjs','utf8');
  assert.match(source,/validateProductionPilotTarget/);
  assert.match(source,/crypto\.randomBytes/);
  assert.match(source,/fixture_source:PRODUCTION_PILOT_SOURCE/);
  assert.match(source,/\['TRANSPORTER','DRIVER'\]/);
  assert.match(source,/preflightPilotCollisions/);
  assert.match(source,/argument\(rollbackRequested\?'--confirm-rollback':'--confirm-additive'\)/);
  assert.doesNotMatch(source,/reset-local|deleteLocalFixtures|SUPABASE_FIXTURE_PASSWORD/);
  assert.doesNotMatch(source,/\.delete\(\)\.not\(/);
});

test('Production pilot requires an exact remote Supabase project confirmation',()=>{
  assert.deepEqual(validateProductionPilotTarget({
    url:'https://tpwyyzoqijjmbvsmmvcm.supabase.co',projectRef:'tpwyyzoqijjmbvsmmvcm',confirmation:'tpwyyzoqijjmbvsmmvcm'
  }),{projectRef:'tpwyyzoqijjmbvsmmvcm',origin:'https://tpwyyzoqijjmbvsmmvcm.supabase.co'});
  assert.throws(()=>validateProductionPilotTarget({url:'http://127.0.0.1:55321',projectRef:'local',confirmation:'local'}),/REMOTE_TARGET_REQUIRED/);
  assert.throws(()=>validateProductionPilotTarget({url:'https://one.supabase.co',projectRef:'one',confirmation:'two'}),/EXACT_PROJECT_CONFIRMATION_REQUIRED/);
  assert.throws(()=>validateProductionPilotTarget({url:'https://one.example.com',projectRef:'one',confirmation:'one'}),/SUPABASE_PROJECT_URL_REQUIRED/);
});

test('the pilot importer produces a verification reference the private reader can retrieve',async()=>{
  const source=fs.readFileSync('scripts/import-production-pilot.mjs','utf8');
  const mapping=source.match(/if\(sourceTable==='verification_requests'&&column==='storage_path'&&value\)value=`([^`]+)`;/);
  assert.ok(mapping,'verification mapping must be explicit');
  const reference=mapping[1].replace('${PRODUCTION_PILOT_SOURCE}',PRODUCTION_PILOT_SOURCE);
  const previousFetch=globalThis.fetch;
  const previousUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bytes=Buffer.from([0xff,0xd8,0xff,0x00]);
  let reads=0;
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://pilot-contract.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-test-service-key';
  globalThis.fetch=async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input.url||input.href);
    assert.equal(url.origin,'https://pilot-contract.supabase.co');
    assert.equal(url.pathname,`/storage/v1/object/verification/${PRODUCTION_PILOT_SOURCE}/verification-placeholder.jpg`);
    assert.equal(init?.method,'GET');reads++;
    return new Response(bytes,{status:200,headers:{'content-type':'image/jpeg'}});
  };
  try{assert.deepEqual(await readPrivateUpload(reference),bytes);assert.equal(reads,1);}
  finally{
    globalThis.fetch=previousFetch;
    if(previousUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previousUrl;
    if(previousKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previousKey;
  }
});
