import {timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {DEMO_MOTION_BODY_LIMIT} from './demo-motion-auth.js';
import {HOSTED_DEMO_MOTION_PATH,hostedDemoMotionSignature} from './demo-motion-hosted-signature.mjs';

export {HOSTED_DEMO_MOTION_PATH,hostedDemoMotionSignature};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hex=/^[a-f0-9]{64}$/;

function exactOrigin(raw){
 const url=new URL(String(raw||''));
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash)
  throw Error('DEMO_HOSTED_DISABLED');
 return url.origin;
}

/** This is separate from the loopback-only local demo adapter. */
export function hostedDemoMotionConfiguration(environment,requestUrl){
 try{
  if(environment.NODE_ENV!=='production'||environment.CONTEXT&&environment.CONTEXT!=='production'
   ||environment.LOADGISTIC_HOSTED_MOTION_ENABLED!=='true'||environment.LOADGISTIC_HOSTED_MOTION_KILL_SWITCH!=='false')
   throw Error('DEMO_HOSTED_DISABLED');
  const siteId=environment.LOADGISTIC_HOSTED_MOTION_SITE_ID;
  if(!uuid.test(siteId||'')||environment.SITE_ID!==siteId)throw Error('DEMO_HOSTED_DISABLED');
  const origin=exactOrigin(environment.LOADGISTIC_HOSTED_MOTION_SITE_ORIGIN);
  if(exactOrigin(environment.URL)!==origin)throw Error('DEMO_HOSTED_DISABLED');
  const request=new URL(requestUrl);
  if(request.origin!==origin||request.pathname!==HOSTED_DEMO_MOTION_PATH||request.search||request.hash
   ||request.username||request.password)throw Error('DEMO_HOSTED_DISABLED');
  const project=exactOrigin(environment.LOADGISTIC_HOSTED_MOTION_SUPABASE_URL);
  if(exactOrigin(environment.NEXT_PUBLIC_SUPABASE_URL)!==project
   ||!new URL(project).hostname.endsWith('.supabase.co'))throw Error('DEMO_HOSTED_DISABLED');
  const secret=environment.HOSTED_DEMO_MOTION_SECRET;
  if(!hex.test(secret||'')||[environment.DEMO_WORLD_WORKER_SECRET,environment.LOADGISTIC_DEMO_MOTION_SECRET,
   environment.SESSION_SECRET,environment.SUPABASE_SERVICE_ROLE_KEY].includes(secret))throw Error('DEMO_HOSTED_DISABLED');
  for(const key of ['TELEMATICS_GATEWAYS_JSON','TELEMATICS_PRIVACY_GATEWAYS_JSON']){
   const gateways=JSON.parse(environment[key]||'[]');
   if(!Array.isArray(gateways)||gateways.some(row=>row?.secret===secret))throw Error('DEMO_HOSTED_DISABLED');
  }
  return {origin,secret};
 }catch{throw Error('DEMO_HOSTED_DISABLED');}
}

export function authenticateHostedDemoMotion(headers,body,config,now=Date.now()){
 const issuedAt=headers.get('x-demo-issued-at'),nonce=headers.get('x-demo-nonce'),signature=headers.get('x-demo-signature');
 if(typeof body!=='string'||Buffer.byteLength(body)>DEMO_MOTION_BODY_LIMIT
  ||!issuedAt||!z.string().datetime({offset:true}).safeParse(issuedAt).success
  ||Math.abs(now-Date.parse(issuedAt))>30000||!uuid.test(nonce||'')||!hex.test(signature||''))
  throw Error('DEMO_HOSTED_AUTH_DENIED');
 const expected=hostedDemoMotionSignature(config.secret,config.origin,body,issuedAt,nonce);
 if(!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(signature,'hex')))
  throw Error('DEMO_HOSTED_AUTH_DENIED');
 return {nonce};
}
