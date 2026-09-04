import { privateStorageStatus } from './private-storage.js';
import { resolveMapTileConfig } from './map-tiles.js';
import { managedAuthCallbackUrl } from './auth-flow.js';
import { emailDeliveryStatus } from './email-provider.js';
import { rateLimitStatus } from './rate-limit.js';
import { trackingCodeSecretConfigured } from './security.js';

const unsafeSessionSecrets=new Set(['','local-development-secret-change-before-production-1234','ci-only-session-secret-not-for-production-123456']);

export function launchReadiness(environment=process.env){
  const production=environment.NODE_ENV==='production';
  const storage=privateStorageStatus(environment);
  const blockers=[];
  const warnings=[];
  const mapTiles=resolveMapTileConfig(environment);
  const emailDelivery=emailDeliveryStatus(environment);
  const rateLimits=rateLimitStatus(environment);
  const secret=String(environment.SESSION_SECRET||'');
  if(production&&(secret.length<32||unsafeSessionSecrets.has(secret)))blockers.push('strong-session-secret');
  if(production&&!trackingCodeSecretConfigured(environment))blockers.push('strong-tracking-code-secret');
  if(production&&(storage.backend!=='supabase'||!storage.configured))blockers.push('durable-private-storage');

  const dataBackend='supabase';
  const authBackend='supabase';
  if(production){
    const callbackReady=Boolean(managedAuthCallbackUrl({environment}));
    if(!callbackReady)blockers.push('managed-auth-callback-url');
    if(environment.ENABLE_LOCAL_FIXTURE_PASSWORD_LOGIN==='true')blockers.push('local-fixture-password-enabled');
    if(!environment.NEXT_PUBLIC_SUPABASE_URL||!environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)blockers.push('supabase-public-config');
    if(!environment.SUPABASE_SERVICE_ROLE_KEY)blockers.push('supabase-service-config');
    if(!emailDelivery.configured)blockers.push('managed-email-delivery');
    if(!rateLimits.configured||!rateLimits.durable)blockers.push('shared-rate-limit-adapter');
    if(!storage.scannerConfigured||!storage.scannerProductionSafe)blockers.push('upload-malware-scanner');
    if(emailDelivery.provider==='smtp')warnings.push('smtp-email-delivery-at-least-once');
    if(mapTiles.communityOsm)warnings.push('community-osm-tile-service');
  }else{
    if(!environment.SUPABASE_SERVICE_ROLE_KEY)warnings.push('supabase-service-config-missing');
  }

  return {
    ok:blockers.length===0,
    runtime:production?'production':'local',
    dataBackend,
    authBackend,
    storageBackend:storage.backend,
    emailProvider:emailDelivery.provider,
    rateLimitBackend:rateLimits.backend,
    mapTileOrigin:mapTiles.origin,
    blockers:[...new Set(blockers)],
    warnings:[...new Set(warnings)]
  };
}
