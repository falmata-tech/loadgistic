import assert from 'node:assert/strict';
import test from 'node:test';
import { launchReadiness } from '../src/lib/launch-readiness.js';

test('local readiness is runnable and production readiness names durable blockers',()=>{
  const local=launchReadiness({NODE_ENV:'development',PRIVATE_STORAGE_BACKEND:'local'});
  assert.equal(local.ok,true);
  assert.ok(local.warnings.includes('local-sqlite-data'));

  const production=launchReadiness({NODE_ENV:'production',PRIVATE_STORAGE_BACKEND:'local',SESSION_SECRET:'short'});
  assert.equal(production.ok,false);
  for(const blocker of ['strong-session-secret','durable-private-storage','managed-postgres-data-backend','supabase-repository-adapter','managed-identity-adapter','shared-rate-limit-adapter','upload-malware-scanner']){
    assert.ok(production.blockers.includes(blocker));
  }
});
