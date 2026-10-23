import crypto from 'node:crypto';

export const PRODUCTION_PILOT_SOURCE='loadgistic-production-pilot-v1';

export function pilotUuid(value){
  const bytes=crypto.createHash('sha256').update(`${PRODUCTION_PILOT_SOURCE}:${String(value)}`).digest().subarray(0,16);
  bytes[6]=(bytes[6]&0x0f)|0x40;
  bytes[8]=(bytes[8]&0x3f)|0x80;
  const hex=bytes.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export function pilotEmail(fixtureKey,existingIdentity){
  if(existingIdentity){
    if(existingIdentity.app_metadata?.fixture_source!==PRODUCTION_PILOT_SOURCE
      ||existingIdentity.user_metadata?.fixture_key!==fixtureKey
      ||!['TRANSPORTER','DRIVER'].includes(existingIdentity.app_metadata?.role)
      ||typeof existingIdentity.email!=='string'
      ||existingIdentity.email.length>254
      ||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(existingIdentity.email)){
      throw new Error('PRODUCTION_PILOT_IDENTITY_MISMATCH');
    }
    return existingIdentity.email;
  }
  const slug=String(fixtureKey||'driver').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,52)||'driver';
  return `pilot-${slug}@pilot.loadgistic.test`;
}

export function validateProductionPilotTarget({url,projectRef,confirmation}){
  let endpoint;
  try{endpoint=new URL(String(url||''));}catch{throw new Error('SUPABASE_PROJECT_URL_REQUIRED');}
  if(['127.0.0.1','localhost','::1'].includes(endpoint.hostname))throw new Error('REMOTE_TARGET_REQUIRED');
  if(endpoint.protocol!=='https:'||!endpoint.hostname.endsWith('.supabase.co'))throw new Error('SUPABASE_PROJECT_URL_REQUIRED');
  const resolvedProjectRef=String(projectRef||'').trim();
  if(endpoint.hostname!==`${resolvedProjectRef}.supabase.co`)throw new Error('SUPABASE_PROJECT_URL_REQUIRED');
  if(String(confirmation||'').trim()!==resolvedProjectRef)throw new Error('EXACT_PROJECT_CONFIRMATION_REQUIRED');
  return {projectRef:resolvedProjectRef,origin:endpoint.origin};
}
