import {createHash,createHmac} from 'node:crypto';

export const HOSTED_DEMO_MOTION_PATH='/api/internal/demo-motion/command';

const uuid=/^(?:[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;
const textLength=(value,min,max)=>typeof value==='string'&&value.length>=min&&value.length<=max;
const deny=()=>{throw Error('DEMO_MOTION_SECRET_DENIED');};

// Keep this dependency-free: the private motion image has no application SDK.
// These are the existing strict gateway/privacy configuration contracts.
function gatewayCredentials(environment,key,privacy){
 const raw=environment[key];
 if(raw===undefined||raw==='')return [];
 if(typeof raw!=='string')deny();
 let rows;try{rows=JSON.parse(raw);}catch{deny();}
 if(!Array.isArray(rows)||rows.length>10)deny();
 const ids=new Set();
 for(const row of rows){
  const keys=privacy?['id','secret']:['id','secret','apiUrl','apiToken'];
  if(!row||typeof row!=='object'||Array.isArray(row)
   ||Object.keys(row).sort().join(',')!==keys.sort().join(',')||typeof row.id!=='string'||!uuid.test(row.id)
   ||ids.has(row.id.toLowerCase())||!textLength(row.secret,32,256))deny();
  ids.add(row.id.toLowerCase());
  if(!privacy){
   if(!textLength(row.apiToken,16,4096)||typeof row.apiUrl!=='string')deny();
   let url;try{url=new URL(row.apiUrl);}catch{deny();}
   if(url.username||url.password||url.search||url.hash||!['http:','https:'].includes(url.protocol)
    ||url.protocol==='http:'&&!['127.0.0.1','localhost','[::1]','traccar','host.docker.internal'].includes(url.hostname))deny();
  }
 }
 return rows;
}

/** A motion HMAC cannot become another configured capability through reuse. */
export function assertMotionSecretIsolation(environment,secret,ownKey){
 if(!['HOSTED_DEMO_MOTION_SECRET','LOADGISTIC_DEMO_MOTION_SECRET'].includes(ownKey)
  ||!textLength(secret,64,64))deny();
 const separate=['DEMO_CAPACITY_WORKER_SECRET','DEMO_WORLD_WORKER_SECRET',
  'HOSTED_DEMO_MOTION_SECRET','LOADGISTIC_DEMO_MOTION_SECRET','SESSION_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SEED_SERVICE_ROLE_KEY','GATEWAY_SECRET',
  'SYNTHETIC_GATEWAY_SECRET','GATEWAY_PRIVACY_SECRET','SYNTHETIC_GATEWAY_PRIVACY_SECRET'];
 if(separate.some(key=>key!==ownKey&&environment[key]===secret))deny();
 for(const [key,privacy] of [['TELEMATICS_GATEWAYS_JSON',false],['TELEMATICS_PRIVACY_GATEWAYS_JSON',true]]){
  if(gatewayCredentials(environment,key,privacy).some(row=>row.secret===secret||row.apiToken===secret))deny();
 }
}

export function hostedDemoMotionSignature(secret,origin,body,issuedAt,nonce){
 const digest=createHash('sha256').update(body).digest('hex');
 return createHmac('sha256',secret).update(['POST',origin,HOSTED_DEMO_MOTION_PATH,issuedAt,nonce,digest].join('\n')).digest('hex');
}
