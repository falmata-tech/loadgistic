import {createHash,createHmac,randomUUID} from 'node:crypto';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digest=/^[a-f0-9]{64}$/;
/** Traccar lists managed accounts rather than the caller; exact own-user GET is separate. */
export function assertPrivacyApiIdentity(listedUsers,identity,expectedId){
 if(!Number.isSafeInteger(expectedId)||expectedId<1||!Array.isArray(listedUsers)||listedUsers.length!==0
  ||!identity||identity.id!==expectedId||identity.administrator!==false||identity.readonly!==false
  ||identity.deviceReadonly!==false||identity.deviceLimit!==0||identity.userLimit!==0||identity.limitCommands!==true)
  throw new Error('PRIVACY_SCOPE_DENIED');
 return true;
}
/**
 * @typedef {{id:string,purpose:'DISABLE'|'ERASE',subjectId:string,deviceId:string,gatewayId:string,
 * gatewayDeviceId:number,imei:string,protocol:string,protocolDeviceId:string,bindingDigest:string,leaseId:string,leaseUntil:string}} PrivacyJob
 * @typedef {{gatewayId:string,now?:()=>number,prepare:(job:PrivacyJob)=>Promise<{state:string,devicePresent?:boolean}>,
 * getDevice:(id:number)=>Promise<object>,disableDevice:(device:object)=>Promise<unknown>,deleteDevice:(id:number)=>Promise<unknown>,
 * verifyAndPurge:(job:PrivacyJob)=>Promise<{state:string}>,
 * complete:(command:{jobId:string,leaseId:string,bindingDigest:string,verified:true})=>Promise<{id:string,state:string}>}} PrivacyPorts
 */
export function parsePrivacyJob(input,gatewayId,now=Date.now()){
 if(!input||typeof input!=='object'||Array.isArray(input)||input.gatewayId!==gatewayId
  ||!['DISABLE','ERASE'].includes(input.purpose)||!Number.isSafeInteger(input.gatewayDeviceId)||input.gatewayDeviceId<1
  ||!['id','subjectId','deviceId','gatewayId','leaseId'].every(key=>uuid.test(input[key]||''))
  ||!digest.test(input.bindingDigest||'')||!/^\d{15}$/.test(input.imei||'')
  ||!['gt06','teltonika','h02','jt808'].includes(input.protocol)||!(/^[A-Za-z0-9:_-]{1,128}$/).test(input.protocolDeviceId||'')
  ||!Number.isFinite(Date.parse(input.leaseUntil))||Date.parse(input.leaseUntil)<=now
  ||Date.parse(input.leaseUntil)>now+61000)throw new Error('INVALID_PRIVACY_JOB');
 return input;
}
export function assertExactPrivacyDevice(job,device){
 if(!device||device.id!==job.gatewayDeviceId||device.uniqueId!==job.protocolDeviceId
  ||device.attributes?.['loadgistic.imei']!==job.imei||device.attributes?.['loadgistic.protocol']!==job.protocol
  ||typeof device.disabled!=='boolean')throw new Error('PRIVACY_BINDING_CHANGED');
 return device;
}
export function signedPrivacyHeaders(config,body,now=new Date(),nonce=randomUUID()){
 const issuedAt=now.toISOString(),hash=createHash('sha256').update(body).digest('hex');
 return {'Content-Type':'application/json','x-telematics-gateway':config.id,'x-telematics-issued-at':issuedAt,
  'x-telematics-nonce':nonce,'x-telematics-signature':createHmac('sha256',config.secret)
   .update(['POST','/api/telematics/privacy',config.id,issuedAt,nonce,hash].join('\n')).digest('hex')};
}
/** Ports separate upstream API changes, scoped durable proofs, and application acknowledgement.
 * @param {PrivacyJob} input @param {PrivacyPorts} ports
 */
export async function processPrivacyJob(input,ports){
 const now=ports.now||Date.now,job=parsePrivacyJob(input,ports.gatewayId,now());
 const fresh=()=>{if(Date.parse(job.leaseUntil)<=now())throw new Error('PRIVACY_LEASE_EXPIRED');};
 fresh();const prepared=await ports.prepare(job);fresh();
 if(prepared.state!=='VERIFIED'){
  if(prepared.devicePresent===true){
   let device=assertExactPrivacyDevice(job,await ports.getDevice(job.gatewayDeviceId));fresh();
   if(!device.disabled){await ports.disableDevice({...device,disabled:true});fresh();}
   device=assertExactPrivacyDevice(job,await ports.getDevice(job.gatewayDeviceId));fresh();
   if(!device.disabled)throw new Error('PRIVACY_DISABLE_UNVERIFIED');
   if(job.purpose==='ERASE'){await ports.deleteDevice(job.gatewayDeviceId);fresh();}
  }else if(job.purpose!=='ERASE')throw new Error('PRIVACY_DISABLE_UNVERIFIED');
  const verified=await ports.verifyAndPurge(job);fresh();
  if(verified.state!=='VERIFIED')throw new Error('PRIVACY_ABSENCE_UNVERIFIED');
 }
 fresh();const receipt=await ports.complete({jobId:job.id,leaseId:job.leaseId,bindingDigest:job.bindingDigest,verified:true});
 if(receipt?.id!==job.id||receipt.state!=='VERIFIED')throw new Error('PRIVACY_ACK_UNVERIFIED');
 return {purpose:job.purpose,state:'VERIFIED'};
}
