import assert from 'node:assert/strict';
import test from 'node:test';
import { launchReadiness } from '../src/lib/launch-readiness.js';

test('local readiness is runnable and production readiness names durable blockers',()=>{
  const local=launchReadiness({NODE_ENV:'development',PRIVATE_STORAGE_BACKEND:'local'});
  assert.equal(local.ok,true);
  assert.ok(local.warnings.includes('local-sqlite-data'));

  const production=launchReadiness({NODE_ENV:'production',PRIVATE_STORAGE_BACKEND:'local',SESSION_SECRET:'short'});
  assert.equal(production.ok,false);
  for(const blocker of ['strong-session-secret','durable-private-storage','managed-postgres-data-backend','managed-auth-backend','supabase-public-config','supabase-service-config','supabase-repository-adapter','managed-identity-adapter','shared-rate-limit-adapter','upload-malware-scanner']){
    assert.ok(production.blockers.includes(blocker));
  }
});

test('local managed runtime does not claim SQLite or silently accept missing service configuration',()=>{
  const configured=launchReadiness({NODE_ENV:'development',DATA_BACKEND:'supabase',AUTH_BACKEND:'supabase',PRIVATE_STORAGE_BACKEND:'supabase',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55321',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'service'});
  assert.equal(configured.ok,true);
  assert.ok(!configured.warnings.includes('local-sqlite-data'));
  const missingService=launchReadiness({NODE_ENV:'development',DATA_BACKEND:'supabase',AUTH_BACKEND:'supabase',PRIVATE_STORAGE_BACKEND:'local'});
  assert.ok(missingService.warnings.includes('supabase-service-config-missing'));
});
