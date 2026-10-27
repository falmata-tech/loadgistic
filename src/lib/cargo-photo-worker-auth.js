import {createHmac,timingSafeEqual} from 'node:crypto';

export const CARGO_PHOTO_CLEANUP_PATH='/.netlify/functions/cargo-photo-cleanup';
export const CARGO_PHOTO_BACKGROUND_PATH='/.netlify/functions/cargo-photo-cleanup-background';
export const CARGO_PHOTO_TIMESTAMP_HEADER='x-loadgistic-cargo-photo-timestamp';
export const CARGO_PHOTO_SIGNATURE_HEADER='x-loadgistic-cargo-photo-signature';

function siteOrigin(environment){
 let expected,actual;
 try{
  expected=new URL(String(environment?.LOADGISTIC_CARGO_PHOTO_SITE_ORIGIN||''));
  actual=new URL(String(environment?.URL||''));
 }catch{throw Error('CARGO_PHOTO_WORKER_DISABLED');}
 if(expected.protocol!=='https:'||expected.username||expected.password
  ||expected.pathname!=='/'||expected.search||expected.hash
  ||actual.href!==expected.href)throw Error('CARGO_PHOTO_WORKER_DISABLED');
 return expected.origin;
}

export function cargoPhotoWorkerEnabled(environment=process.env){
 if(environment?.LOADGISTIC_CARGO_PHOTO_CLEANUP_ENABLED!=='true'
  ||environment?.CONTEXT!=='production'||environment?.NODE_ENV!=='production'
  ||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String(environment?.LOADGISTIC_CARGO_PHOTO_SITE_ID||''))
  ||environment?.SITE_ID!==environment?.LOADGISTIC_CARGO_PHOTO_SITE_ID)return false;
 try{return Boolean(siteOrigin(environment)&&signingSecret(environment));}catch{return false;}
}

function signingSecret(environment){
 const secret=String(environment?.LOADGISTIC_CARGO_PHOTO_WORKER_SECRET||'');
 if(secret.length<32||secret===String(environment?.SESSION_SECRET||'')
  ||/^(?:test|local|ci|placeholder|change-me|example)/i.test(secret)){
  throw Error('CARGO_PHOTO_WORKER_SECRET_UNAVAILABLE');
 }
 return secret;
}

function backgroundTarget(url,environment){
 let target;
 try{target=new URL(String(url||''));}catch{throw Error('CARGO_PHOTO_WORKER_TARGET_INVALID');}
 if(target.origin!==siteOrigin(environment)||target.pathname!==CARGO_PHOTO_BACKGROUND_PATH
  ||target.search||target.hash)throw Error('CARGO_PHOTO_WORKER_TARGET_INVALID');
 return target;
}

export function createCargoPhotoSignature({timestamp,url},environment=process.env){
 const issued=String(timestamp||'');
 if(!/^\d{13}$/.test(issued))throw Error('CARGO_PHOTO_WORKER_TIMESTAMP_INVALID');
 const target=backgroundTarget(url,environment);
 return createHmac('sha256',signingSecret(environment))
  .update(`loadgistic-cargo-photo-cleanup:v1:POST:${target.origin}:${target.pathname}:${issued}`,'utf8')
  .digest('hex');
}

export function verifyCargoPhotoSignature({timestamp,signature,url},environment=process.env,now=Date.now()){
 const issued=String(timestamp||''),signed=String(signature||'');
 if(!cargoPhotoWorkerEnabled(environment)||!/^\d{13}$/.test(issued)
  ||!/^[a-f0-9]{64}$/.test(signed))return false;
 const time=Number(issued);
 if(!Number.isSafeInteger(time)||Math.abs(Number(now)-time)>2*60_000)return false;
 let expected;
 try{expected=createCargoPhotoSignature({timestamp:issued,url},environment);}catch{return false;}
 return timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(signed,'hex'));
}
