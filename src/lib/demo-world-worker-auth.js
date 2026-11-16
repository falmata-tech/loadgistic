import {createHash,createHmac,timingSafeEqual} from 'node:crypto';

export const DEMO_WORLD_TIMESTAMP_HEADER='x-loadgistic-demo-world-timestamp';
export const DEMO_WORLD_SIGNATURE_HEADER='x-loadgistic-demo-world-signature';
export const DEMO_WORLD_BACKGROUND_PATH='/.netlify/functions/demo-world-background';
export const DEMO_WORLD_ADVANCE_PATH='/api/internal/demo-world/advance';
export const DEMO_CAPACITY_ADVANCE_PATH='/api/internal/demo-world/capacity/advance';
export const DEMO_WORLD_BATCH_LIMIT=5;

const SIGNATURE_LIFETIME_MS=2*60_000;
const PURPOSE_PATHS=Object.freeze({
  dispatch:DEMO_WORLD_BACKGROUND_PATH,
  advance:DEMO_WORLD_ADVANCE_PATH,
  'capacity-advance':DEMO_CAPACITY_ADVANCE_PATH
});

function configuredOrigin(environment){
  let origin;
  try{origin=new URL(String(environment?.LOADGISTIC_DEMO_WORLD_SITE_ORIGIN||''));}
  catch{throw Error('DEMO_WORLD_ORIGIN_UNAVAILABLE');}
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'
    ||origin.search||origin.hash||origin.origin!==origin.href.replace(/\/$/,'')){
    throw Error('DEMO_WORLD_ORIGIN_UNAVAILABLE');
  }
  return origin.origin;
}

export function demoWorldWorkerEnabled(environment=process.env){
  if(environment?.LOADGISTIC_DEMO_WORLD_ENABLED!=='true'
    ||environment?.LOADGISTIC_DEMO_WORLD_KILL_SWITCH!=='false'
    ||(environment?.CONTEXT&&environment.CONTEXT!=='production')
    ||(environment?.NODE_ENV&&environment.NODE_ENV!=='production'))return false;
  const expectedSite=String(environment?.LOADGISTIC_DEMO_WORLD_SITE_ID||'');
  if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(expectedSite)
    ||environment?.SITE_ID!==expectedSite)return false;
  try{
    const actual=new URL(String(environment?.URL||''));
    return actual.origin===configuredOrigin(environment)
      &&actual.href===actual.origin+'/'&&actual.protocol==='https:';
  }catch{return false;}
}

export function demoWorldOrigin(environment=process.env){
  return configuredOrigin(environment);
}

function signingSecret(environment,purpose){
  const capacity=purpose==='capacity-advance';
  const key=capacity?'DEMO_CAPACITY_WORKER_SECRET':'DEMO_WORLD_WORKER_SECRET';
  const secret=String(environment?.[key]||'');
  const otherKeys=['SESSION_SECRET','HOSTED_DEMO_MOTION_SECRET','LOADGISTIC_DEMO_MOTION_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SEED_SERVICE_ROLE_KEY','GATEWAY_SECRET','SYNTHETIC_GATEWAY_SECRET',
    'GATEWAY_PRIVACY_SECRET','SYNTHETIC_GATEWAY_PRIVACY_SECRET',
    ...(capacity?['DEMO_WORLD_WORKER_SECRET']:['DEMO_CAPACITY_WORKER_SECRET'])];
  if(secret.length<32||otherKeys.some(other=>environment?.[other]===secret)
    ||/^(?:test|local|ci|placeholder|change-me|example)/i.test(secret)){
    throw Error('DEMO_WORLD_SIGNING_SECRET_UNAVAILABLE');
  }
  // The server knows the gateway keys; a narrow worker never receives them.
  // Invalid configured key lists cannot silently bypass collision checking.
  for(const key of ['TELEMATICS_GATEWAYS_JSON','TELEMATICS_PRIVACY_GATEWAYS_JSON']){
    try{
      const rows=JSON.parse(environment?.[key]||'[]');
      if(!Array.isArray(rows)||rows.length>10)throw Error();
      const privacy=key==='TELEMATICS_PRIVACY_GATEWAYS_JSON',ids=new Set();
      for(const row of rows){
        const fields=privacy?['id','secret']:['apiToken','apiUrl','id','secret'];
        if(!row||typeof row!=='object'||Array.isArray(row)
          ||Object.keys(row).sort().join(',')!==fields.join(',')
          ||typeof row.id!=='string'||!/^(?:[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i.test(row.id)
          ||ids.has(row.id.toLowerCase())||typeof row.secret!=='string'
          ||row.secret.length<32||row.secret.length>256||row.secret===secret)throw Error();
        ids.add(row.id.toLowerCase());
        if(!privacy){
          if(typeof row.apiToken!=='string'||row.apiToken.length<16||row.apiToken.length>4096
            ||row.apiToken===secret||typeof row.apiUrl!=='string')throw Error();
          const url=new URL(row.apiUrl);
          if(url.username||url.password||url.search||url.hash||!['http:','https:'].includes(url.protocol)
            ||url.protocol==='http:'&&!['127.0.0.1','localhost','[::1]','traccar','host.docker.internal'].includes(url.hostname))throw Error();
        }
      }
    }catch{throw Error('DEMO_WORLD_SIGNING_SECRET_UNAVAILABLE');}
  }
  return secret;
}

function signedTarget({url,purpose,environment}){
  let target;
  try{target=new URL(String(url||''));}catch{throw Error('DEMO_WORLD_TARGET_INVALID');}
  if(!Object.hasOwn(PURPOSE_PATHS,purpose)||target.origin!==configuredOrigin(environment)
    ||target.pathname!==PURPOSE_PATHS[purpose]||target.search||target.hash){
    throw Error('DEMO_WORLD_TARGET_INVALID');
  }
  return target;
}

export function createDemoWorldSignature({timestamp,url,purpose,body=''},environment=process.env){
  const issued=String(timestamp||'');
  if(!/^\d{13}$/.test(issued)||typeof body!=='string')throw Error('DEMO_WORLD_SIGNATURE_INPUT_INVALID');
  const target=signedTarget({url,purpose,environment});
  const digest=createHash('sha256').update(body,'utf8').digest('hex');
  const content=`loadgistic-demo-world:v1:${purpose}:POST:${target.origin}:${target.pathname}:${issued}:${digest}`;
  return createHmac('sha256',signingSecret(environment,purpose)).update(content,'utf8').digest('hex');
}

export function verifyDemoWorldSignature({timestamp,signature,url,purpose,body=''},environment=process.env,now=Date.now()){
  const issued=String(timestamp||'');
  const signed=String(signature||'');
  if(!demoWorldWorkerEnabled(environment)||!/^\d{13}$/.test(issued)
    ||!/^[a-f0-9]{64}$/.test(signed)||typeof body!=='string')return false;
  const time=Number(issued);
  if(!Number.isSafeInteger(time)||Math.abs(Number(now)-time)>SIGNATURE_LIFETIME_MS)return false;
  let expected;
  try{expected=createDemoWorldSignature({timestamp:issued,url,purpose,body},environment);}catch{return false;}
  return timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(signed,'hex'));
}
