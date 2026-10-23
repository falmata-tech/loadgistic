import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {DEMO_MOTION_COHORT} from './demo-motion-cohort.js';

export const DEMO_MOTION_PATH='/api/telematics/demo-motion';
export const DEMO_MOTION_BODY_LIMIT=4096;
export const DEMO_MOTION_TARGETS=Object.freeze(Object.fromEntries(Object.entries(DEMO_MOTION_COHORT).map(([name,row])=>[name,row.vehicleId])));
const target=z.enum(Object.keys(DEMO_MOTION_TARGETS));
const lease={target,leaseId:z.string().uuid(),epoch:z.number().int().positive().safe()};
export const demoMotionCommand=z.discriminatedUnion('action',[
 z.object({action:z.literal('CONFIGURE'),target}).strict(),
 z.object({action:z.literal('STATUS'),target}).strict(),
 z.object({action:z.literal('START'),target,seconds:z.number().int().min(10).max(3600)}).strict(),
 z.object({action:z.literal('RESUME'),target,seconds:z.number().int().min(10).max(3600)}).strict(),
 z.object({action:z.literal('STOP'),...lease}).strict(),
 z.object({action:z.literal('GPS'),...lease,latitude:z.number().finite(),longitude:z.number().finite()}).strict(),
 z.object({action:z.literal('PHONE'),...lease,latitude:z.number().finite(),longitude:z.number().finite()}).strict()
]);
export function localDemoMotionConfiguration(environment,requestUrl){
 const db=new URL(environment.NEXT_PUBLIC_SUPABASE_URL||'https://disabled.invalid');
 const request=new URL(requestUrl),secret=environment.LOADGISTIC_DEMO_MOTION_SECRET;
 if(environment.NODE_ENV==='production'||environment.LOADGISTIC_DEMO_MOTION_ENABLED!=='true'
  ||db.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(db.hostname)||db.port!=='55321'
  ||db.username||db.password||db.pathname!=='/'||db.search||db.hash
  ||request.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(request.hostname)||request.port!=='3100'
  ||request.pathname!==DEMO_MOTION_PATH||request.search||request.hash||request.username||request.password
  ||typeof secret!=='string'||!/^[a-f0-9]{64}$/.test(secret)
  ||secret===environment.SUPABASE_SERVICE_ROLE_KEY)throw Error('DEMO_REQUEST_DENIED');
 // The demo credential cannot double as either gateway credential.
 let gateways,privacy;try{gateways=JSON.parse(environment.TELEMATICS_GATEWAYS_JSON||'[]');privacy=JSON.parse(environment.TELEMATICS_PRIVACY_GATEWAYS_JSON||'[]');}catch{throw Error('DEMO_REQUEST_DENIED');}
 if(!Array.isArray(gateways)||!Array.isArray(privacy)||[...gateways,...privacy].some(row=>row?.secret===secret))throw Error('DEMO_REQUEST_DENIED');
 return {secret};
}
export function demoMotionSignature(secret,body,issuedAt,nonce){
 return createHmac('sha256',secret).update(['POST',DEMO_MOTION_PATH,issuedAt,nonce,createHash('sha256').update(body).digest('hex')].join('\n')).digest('hex');
}
export function authenticateDemoMotion(headers,body,config,now=Date.now()){
 const issuedAt=headers.get('x-demo-issued-at'),nonce=headers.get('x-demo-nonce'),signature=headers.get('x-demo-signature');
 if(!issuedAt||!z.string().datetime({offset:true}).safeParse(issuedAt).success||Math.abs(now-Date.parse(issuedAt))>30000
  ||!nonce||!z.string().uuid().safeParse(nonce).success||!signature||!/^[a-f0-9]{64}$/.test(signature)
  ||Buffer.byteLength(body)>DEMO_MOTION_BODY_LIMIT)throw Error('DEMO_REQUEST_DENIED');
 if(!timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(demoMotionSignature(config.secret,body,issuedAt,nonce),'hex')))throw Error('DEMO_REQUEST_DENIED');
 return {nonce};
}
/** Narrow application port; no caller-selected RPC, actor, vehicle or destination. */
export async function executeDemoMotion(input,rpc){
 const command=demoMotionCommand.parse(input),target_vehicle_id=DEMO_MOTION_TARGETS[command.target];
 if(command.action==='CONFIGURE')return rpc('configure_demo_motion_target',{target_vehicle_id});
 if(command.action==='STATUS')return rpc('demo_motion_status',{target_vehicle_id});
 if(command.action==='START'||command.action==='RESUME')return rpc('start_demo_motion',{target_vehicle_id,requested_seconds:command.seconds,explicit_resume:command.action==='RESUME'});
 const authority={target_vehicle_id,expected_lease_id:command.leaseId,expected_epoch:command.epoch};
 if(command.action==='STOP')return rpc('stop_demo_motion',authority);
 return rpc(command.action==='GPS'?'reserve_demo_gps_tick':'report_demo_phone_location',{...authority,latitude:command.latitude,longitude:command.longitude});
}
