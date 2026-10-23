import {createHash,createHmac,timingSafeEqual} from 'node:crypto';

export const DEMO_WORLD_TIMESTAMP_HEADER='x-loadgistic-demo-world-timestamp';
export const DEMO_WORLD_SIGNATURE_HEADER='x-loadgistic-demo-world-signature';
export const DEMO_WORLD_BACKGROUND_PATH='/.netlify/functions/demo-world-background';
export const DEMO_WORLD_ADVANCE_PATH='/api/internal/demo-world/advance';
export const DEMO_WORLD_BATCH_LIMIT=5;

const SIGNATURE_LIFETIME_MS=2*60_000;
const PURPOSE_PATHS=Object.freeze({
  dispatch:DEMO_WORLD_BACKGROUND_PATH,
  advance:DEMO_WORLD_ADVANCE_PATH
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

function signingSecret(environment){
  const secret=String(environment?.DEMO_WORLD_WORKER_SECRET||'');
  if(secret.length<32||secret===String(environment?.SESSION_SECRET||'')
    ||/^(?:test|local|ci|placeholder|change-me|example)/i.test(secret)){
    throw Error('DEMO_WORLD_SIGNING_SECRET_UNAVAILABLE');
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
  return createHmac('sha256',signingSecret(environment)).update(content,'utf8').digest('hex');
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
