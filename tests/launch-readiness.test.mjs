import assert from 'node:assert/strict';
import test from 'node:test';
import { launchReadiness } from '../src/lib/launch-readiness.js';

test('local readiness is runnable and production readiness names durable blockers',()=>{
  const local=launchReadiness({NODE_ENV:'development'});
  assert.equal(local.ok,true);
  assert.equal(local.dataBackend,'supabase');
  assert.equal(local.storageBackend,'supabase');
  assert.ok(local.warnings.includes('supabase-service-config-missing'));
  const localMail=launchReadiness({NODE_ENV:'development',LOADGISTIC_LOCAL_MAILPIT_URL:'http://127.0.0.1:55324'});
  assert.equal(localMail.emailProvider,'mailpit');

  const production=launchReadiness({NODE_ENV:'production',SESSION_SECRET:'short'});
  assert.equal(production.ok,false);
  assert.ok(production.warnings.includes('community-osm-tile-service'));
  for(const blocker of ['strong-session-secret','strong-tracking-code-secret','durable-private-storage','managed-auth-callback-url','supabase-public-config','supabase-service-config','managed-email-delivery','shared-rate-limit-adapter','upload-malware-scanner']){
    assert.ok(production.blockers.includes(blocker));
  }
});

test('production requires managed transactional email and exposes only its provider name',()=>{
  const common={
    NODE_ENV:'production',APP_URL:'https://loadgistic.example',
    SESSION_SECRET:'a-secure-production-session-secret-that-is-long',
    TRACKING_CODE_SECRET:'a-distinct-production-tracking-code-secret-that-is-long',NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'service'
  };
  const missing=launchReadiness(common);
  assert.equal(missing.emailProvider,'none');
  assert.ok(missing.blockers.includes('managed-email-delivery'));
  const localOnly=launchReadiness({...common,LOADGISTIC_LOCAL_MAILPIT_URL:'http://127.0.0.1:55324'});
  assert.equal(localOnly.emailProvider,'none');
  assert.ok(localOnly.blockers.includes('managed-email-delivery'));
  const configured=launchReadiness({...common,RESEND_API_KEY:'re_private',LOADGISTIC_EMAIL_FROM:'updates@loadgistic.example'});
  assert.equal(configured.emailProvider,'resend');
  assert.equal(configured.rateLimitBackend,'supabase');
  assert.ok(!configured.blockers.includes('managed-email-delivery'));
  assert.ok(!configured.blockers.includes('shared-rate-limit-adapter'));
  assert.doesNotMatch(JSON.stringify(configured),/re_private|updates@loadgistic/);

  const smtp=launchReadiness({...common,
    LOADGISTIC_SMTP_HOST:'smtp.gmail.com',LOADGISTIC_SMTP_PORT:'465',
    LOADGISTIC_SMTP_USER:'sender@example.test',LOADGISTIC_SMTP_PASSWORD:'smtp-private-secret',
    LOADGISTIC_EMAIL_FROM:'Loadgistic <sender@example.test>'
  });
  assert.equal(smtp.emailProvider,'smtp');
  assert.ok(!smtp.blockers.includes('managed-email-delivery'));
  assert.ok(smtp.warnings.includes('smtp-email-delivery-at-least-once'));
  assert.doesNotMatch(JSON.stringify(smtp),/smtp-private-secret|sender@example/);

  const partialSmtp=launchReadiness({...common,
    LOADGISTIC_SMTP_HOST:'smtp.gmail.com',LOADGISTIC_SMTP_PORT:'465',
    LOADGISTIC_SMTP_USER:'sender@example.test',LOADGISTIC_EMAIL_FROM:'sender@example.test'
  });
  assert.equal(partialSmtp.emailProvider,'none');
  assert.ok(partialSmtp.blockers.includes('managed-email-delivery'));
});

test('production rejects an unsafe auth callback and local fixture password flag',()=>{
  const result=launchReadiness({
    NODE_ENV:'production',APP_URL:'http://loadgistic.example',
    ENABLE_LOCAL_FIXTURE_PASSWORD_LOGIN:'true',
    SESSION_SECRET:'a-secure-production-session-secret-that-is-long',
    TRACKING_CODE_SECRET:'a-distinct-production-tracking-code-secret-that-is-long',
    NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'service'
  });
  assert.ok(result.blockers.includes('managed-auth-callback-url'));
  assert.ok(result.blockers.includes('local-fixture-password-enabled'));
});

test('production accepts only a configured managed upload scanner',()=>{
  const common={
    NODE_ENV:'production',APP_URL:'https://loadgistic.example',
    SESSION_SECRET:'a-secure-production-session-secret-that-is-long',
    TRACKING_CODE_SECRET:'a-distinct-production-tracking-code-secret-that-is-long',NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'service'
  };
  assert.ok(launchReadiness({...common,UPLOAD_SCANNER_BACKEND:'local'}).blockers.includes('upload-malware-scanner'));
  const managed=launchReadiness({...common,UPLOAD_SCANNER_BACKEND:'cloudmersive',CLOUDMERSIVE_API_KEY:'private'});
  assert.ok(!managed.blockers.includes('upload-malware-scanner'));
  assert.doesNotMatch(JSON.stringify(managed),/private/);
});

test('production requires a strong Tracking code secret distinct from the login-session secret',()=>{
  const session='a-secure-production-session-secret-that-is-long';
  const common={NODE_ENV:'production',SESSION_SECRET:session};
  for(const TRACKING_CODE_SECRET of [
    '', 'short', 'local-development-tracking-code-secret-not-for-production',
    'local-development-secret-change-before-production-1234',
    'ci-only-session-secret-not-for-production-123456',
    'ci-only-tracking-code-secret-not-for-production-123456', session
  ]){
    const result=launchReadiness({...common,TRACKING_CODE_SECRET});
    assert.ok(result.blockers.includes('strong-tracking-code-secret'));
    assert.doesNotMatch(JSON.stringify(result),/tracking-code-secret-not-for-production|a-secure-production-session-secret/);
  }
  const ready=launchReadiness({...common,TRACKING_CODE_SECRET:'a-distinct-production-tracking-code-secret-that-is-long'});
  assert.ok(!ready.blockers.includes('strong-tracking-code-secret'));
});

test('local managed runtime does not claim SQLite or silently accept missing service configuration',()=>{
  const configured=launchReadiness({NODE_ENV:'development',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55321',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'service'});
  assert.equal(configured.ok,true);
  assert.deepEqual(configured.warnings,[]);
  const missingService=launchReadiness({NODE_ENV:'development'});
  assert.ok(missingService.warnings.includes('supabase-service-config-missing'));
  assert.equal(missingService.dataBackend,'supabase');
  assert.equal(missingService.storageBackend,'supabase');
});
