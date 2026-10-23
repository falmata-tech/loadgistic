import {createHmac,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {bodyDigest,gatewayTokenDigest} from './telematics-gateway-auth.js';

export const PRIVACY_BODY_LIMIT=16384;
export const PRIVACY_PATH='/api/telematics/privacy';
const configuration=z.object({id:z.string().uuid(),secret:z.string().min(32).max(256)}).strict();
export function loadPrivacyConfigurations(raw=process.env.TELEMATICS_PRIVACY_GATEWAYS_JSON){
 try{
  const rows=z.array(configuration).max(10).parse(JSON.parse(raw||'[]'));
  if(new Set(rows.map(row=>row.id)).size!==rows.length)throw new Error();
  return rows;
 }catch{throw new Error('PRIVACY_GATEWAY_UNAVAILABLE');}
}
export function privacySignature(config,body,issuedAt,nonce){
 return createHmac('sha256',config.secret).update(['POST',PRIVACY_PATH,config.id,issuedAt,nonce,bodyDigest(body)].join('\n')).digest('hex');
}
/** Separate secret, path and SQL nonce authority; ingest credentials grant no privacy permission. */
export function authenticatePrivacyGateway(headers,body,configurations,now=Date.now()){
 const id=headers.get('x-telematics-gateway'),issuedAt=headers.get('x-telematics-issued-at'),nonce=headers.get('x-telematics-nonce'),signature=headers.get('x-telematics-signature');
 const config=configurations.find(row=>row.id===id);
 if(!config||!issuedAt||!nonce||!signature||!z.string().uuid().safeParse(nonce).success
  ||!z.string().datetime({offset:true}).safeParse(issuedAt).success||Math.abs(now-Date.parse(issuedAt))>120000
  ||!(/^[a-f0-9]{64}$/).test(signature))throw new Error('PRIVACY_GATEWAY_UNAVAILABLE');
 if(!timingSafeEqual(Buffer.from(privacySignature(config,body,issuedAt,nonce),'hex'),Buffer.from(signature,'hex')))
  throw new Error('PRIVACY_GATEWAY_UNAVAILABLE');
 return {digest:gatewayTokenDigest(config.secret),nonce,bodyDigest:bodyDigest(body),issuedAt};
}
