import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
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
