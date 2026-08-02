import { privateStorageStatus } from './private-storage.js';

const unsafeSessionSecrets=new Set(['','local-development-secret-change-before-production-1234','ci-only-session-secret-not-for-production-123456']);

export function launchReadiness(environment=process.env){
  const production=environment.NODE_ENV==='production';
  const storage=privateStorageStatus(environment);
  const blockers=[];
  const warnings=[];
  const secret=String(environment.SESSION_SECRET||'');
  if(production&&(secret.length<32||unsafeSessionSecrets.has(secret)))blockers.push('strong-session-secret');
  if(production&&(storage.backend!=='supabase'||!storage.configured))blockers.push('durable-private-storage');

  const dataBackend=String(environment.DATA_BACKEND||'sqlite').toLowerCase();
  if(production){
    if(dataBackend!=='supabase')blockers.push('managed-postgres-data-backend');
    blockers.push('supabase-repository-adapter');
    blockers.push('managed-identity-adapter');
    blockers.push('shared-rate-limit-adapter');
    blockers.push('upload-malware-scanner');
  }else{
    warnings.push('local-sqlite-data');
    if(storage.backend==='local')warnings.push('local-private-storage');
  }

  return {
    ok:blockers.length===0,
    runtime:production?'production':'local',
    dataBackend,
    storageBackend:storage.backend,
    blockers:[...new Set(blockers)],
    warnings:[...new Set(warnings)]
  };
}
