import {createHmac,timingSafeEqual} from 'node:crypto';

export const MANAGED_OPERATIONS_TIMESTAMP_HEADER='x-loadgistic-operations-timestamp';
export const MANAGED_OPERATIONS_SIGNATURE_HEADER='x-loadgistic-operations-signature';

const UNSAFE_OPERATIONS_SECRETS=new Set([
  '',
  'local-development-secret-change-before-production-1234',
  'ci-only-session-secret-not-for-production-123456'
]);

function operationsSecret(environment){
  const value=String(environment?.SESSION_SECRET||'');
  if(value.length<32||UNSAFE_OPERATIONS_SECRETS.has(value))throw new Error('MANAGED_OPERATIONS_SECRET_UNAVAILABLE');
  return value;
}

function operationsAudience(value){
  let url;
  try{url=new URL(String(value||''));}catch{throw new Error('MANAGED_OPERATIONS_AUDIENCE_INVALID');}
  if(url.protocol!=='https:'&&!(['127.0.0.1','localhost'].includes(url.hostname)&&url.protocol==='http:')){
    throw new Error('MANAGED_OPERATIONS_AUDIENCE_INVALID');
  }
  return url.origin;
}

export function createManagedOperationsSignature({timestamp,audience},environment=process.env){
  const normalized=String(timestamp||'');
  if(!/^\d{13}$/.test(normalized))throw new Error('MANAGED_OPERATIONS_TIMESTAMP_INVALID');
  const normalizedAudience=operationsAudience(audience);
  return createHmac('sha256',operationsSecret(environment))
    .update(`loadgistic-managed-operations:${normalizedAudience}:${normalized}`,'utf8')
    .digest('hex');
}

export function verifyManagedOperationsSignature({timestamp,signature,audience},environment=process.env,now=Date.now()){
  const normalizedTimestamp=String(timestamp||'');
  const normalizedSignature=String(signature||'');
  if(!/^\d{13}$/.test(normalizedTimestamp)||!/^[a-f0-9]{64}$/.test(normalizedSignature))return false;
  const issuedAt=Number(normalizedTimestamp);
  if(!Number.isSafeInteger(issuedAt)||Math.abs(Number(now)-issuedAt)>5*60_000)return false;
  let expected;
  try{expected=createManagedOperationsSignature({timestamp:normalizedTimestamp,audience},environment);}catch{return false;}
  return timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(normalizedSignature,'hex'));
}
