import assert from 'node:assert/strict';
import test from 'node:test';
import { launchReadiness } from '../src/lib/launch-readiness.js';

test('local readiness is runnable and production readiness names durable blockers',()=>{
  const local=launchReadiness({NODE_ENV:'development',PRIVATE_STORAGE_BACKEND:'local'});
  assert.equal(local.ok,true);
  assert.ok(local.warnings.includes('local-sqlite-data'));

  const production=launchReadiness({NODE_ENV:'production',PRIVATE_STORAGE_BACKEND:'local',SESSION_SECRET:'short'});
  assert.equal(production.ok,false);
  assert.ok(production.warnings.includes('community-osm-tile-service'));
  for(const blocker of ['strong-session-secret','durable-private-storage','managed-postgres-data-backend','managed-auth-backend','managed-auth-callback-url','supabase-public-config','supabase-service-config','managed-email-delivery','supabase-repository-adapter','managed-identity-adapter','shared-rate-limit-adapter','upload-malware-scanner']){
    assert.ok(production.blockers.includes(blocker));
  }
});

test('production requires managed transactional email and exposes only its provider name',()=>{
  const common={
    NODE_ENV:'production',APP_URL:'https://loadgistic.example',AUTH_BACKEND:'supabase',
    PRIVATE_STORAGE_BACKEND:'supabase',SESSION_SECRET:'a-secure-production-session-secret-that-is-long',
    DATA_BACKEND:'supabase',NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'service'
  };
  const missing=launchReadiness(common);
  assert.equal(missing.emailProvider,'none');
  assert.ok(missing.blockers.includes('managed-email-delivery'));
  const configured=launchReadiness({...common,RESEND_API_KEY:'re_private',LOADGISTIC_EMAIL_FROM:'updates@loadgistic.example'});
  assert.equal(configured.emailProvider,'resend');
  assert.ok(!configured.blockers.includes('managed-email-delivery'));
  assert.doesNotMatch(JSON.stringify(configured),/re_private|updates@loadgistic/);
});

test('production rejects an unsafe auth callback and local fixture password flag',()=>{
  const result=launchReadiness({
    NODE_ENV:'production',APP_URL:'http://loadgistic.example',AUTH_BACKEND:'supabase',
    ENABLE_LOCAL_FIXTURE_PASSWORD_LOGIN:'true',PRIVATE_STORAGE_BACKEND:'supabase',
    SESSION_SECRET:'a-secure-production-session-secret-that-is-long',
    DATA_BACKEND:'supabase',NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'service'
  });
  assert.ok(result.blockers.includes('managed-auth-callback-url'));
  assert.ok(result.blockers.includes('local-fixture-password-enabled'));
});

test('local managed runtime does not claim SQLite or silently accept missing service configuration',()=>{
  const configured=launchReadiness({NODE_ENV:'development',DATA_BACKEND:'supabase',AUTH_BACKEND:'supabase',PRIVATE_STORAGE_BACKEND:'supabase',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55321',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'service'});
  assert.equal(configured.ok,true);
  assert.ok(!configured.warnings.includes('local-sqlite-data'));
  const missingService=launchReadiness({NODE_ENV:'development',DATA_BACKEND:'supabase',AUTH_BACKEND:'supabase',PRIVATE_STORAGE_BACKEND:'local'});
  assert.ok(missingService.warnings.includes('supabase-service-config-missing'));
});
