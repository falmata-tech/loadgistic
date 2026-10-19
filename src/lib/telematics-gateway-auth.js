import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';

export const GATEWAY_BODY_LIMIT=131072;
export const gatewayConfigSchema=z.object({id:z.string().uuid(),secret:z.string().min(32).max(256),
 apiUrl:z.string().url(),apiToken:z.string().min(16).max(4096)}).strict();
export function loadGatewayConfigurations(raw=process.env.TELEMATICS_GATEWAYS_JSON){
 try{
  const rows=z.array(gatewayConfigSchema).max(10).parse(JSON.parse(raw||'[]'));
  if(new Set(rows.map(row=>row.id)).size!==rows.length)throw new Error();
  for(const row of rows){const url=new URL(row.apiUrl);
   if(url.username||url.password||url.search||url.hash||!['http:','https:'].includes(url.protocol))throw new Error();
   if(url.protocol==='http:'&&!['127.0.0.1','localhost','[::1]','traccar','host.docker.internal'].includes(url.hostname))throw new Error();
  }
  return rows;
 }catch{throw new Error('GATEWAY_UNAVAILABLE');}
}
export const bodyDigest=body=>createHash('sha256').update(body).digest('hex');
export const gatewayTokenDigest=secret=>bodyDigest(secret);
export function gatewaySignature(config,body,issuedAt,nonce){
 return createHmac('sha256',config.secret).update(['POST','/api/telematics/gateway',config.id,issuedAt,nonce,bodyDigest(body)].join('\n')).digest('hex');
}
export function authenticateGateway(headers,body,configurations,now=Date.now()){
 const id=headers.get('x-telematics-gateway'),issuedAt=headers.get('x-telematics-issued-at'),nonce=headers.get('x-telematics-nonce'),signature=headers.get('x-telematics-signature');
 const config=configurations.find(row=>row.id===id);
 if(!config||!issuedAt||!nonce||!signature||!z.string().uuid().safeParse(nonce).success
  ||!z.string().datetime({offset:true}).safeParse(issuedAt).success||Math.abs(now-Date.parse(issuedAt))>120000||!(/^[a-f0-9]{64}$/).test(signature))throw new Error('GATEWAY_UNAVAILABLE');
 const expected=gatewaySignature(config,body,issuedAt,nonce);
 if(!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(signature,'hex')))throw new Error('GATEWAY_UNAVAILABLE');
 return {config,digest:gatewayTokenDigest(config.secret),nonce,issuedAt,bodyDigest:bodyDigest(body)};
}
/** Server configuration chooses the destination; an administrator's JSON cannot change it. */
export async function verifyGatewayDevice(command,configurations=loadGatewayConfigurations()){
 const config=configurations.find(row=>row.id===command.gatewayId);if(!config)throw new Error('GATEWAY_UNAVAILABLE');
 const response=await fetch(new URL(`devices/${command.gatewayDeviceId}`,config.apiUrl.endsWith('/')?config.apiUrl:`${config.apiUrl}/`),{
  headers:{Authorization:`Bearer ${config.apiToken}`,Accept:'application/json'},signal:AbortSignal.timeout(5000),redirect:'error',cache:'no-store'});
 if(!response.ok)throw new Error('GATEWAY_UNAVAILABLE');
 const length=Number(response.headers.get('content-length')||0);if(length>16384)throw new Error('GATEWAY_UNAVAILABLE');
 if(!response.body)throw new Error('GATEWAY_UNAVAILABLE');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
   if(size>16384){await reader.cancel();throw new Error('GATEWAY_UNAVAILABLE');}chunks.push(part.value);}}
 finally{reader.releaseLock();}
 const text=Buffer.concat(chunks).toString('utf8');
 let device;try{device=JSON.parse(text);}catch{throw new Error('GATEWAY_UNAVAILABLE');}
 if(device.id!==command.gatewayDeviceId||device.disabled||device.uniqueId!==command.protocolDeviceId
  ||device.attributes?.['loadgistic.imei']!==command.imei||device.attributes?.['loadgistic.protocol']!==command.protocol
  ||device.attributes?.['loadgistic.synthetic']!==command.synthetic)throw new Error('DEVICE_BINDING_CONFLICT');
 return true;
}
