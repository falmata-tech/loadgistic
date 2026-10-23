import {createHash,createHmac} from 'node:crypto';

export const HOSTED_DEMO_MOTION_PATH='/api/internal/demo-motion/command';

export function hostedDemoMotionSignature(secret,origin,body,issuedAt,nonce){
 const digest=createHash('sha256').update(body).digest('hex');
 return createHmac('sha256',secret).update(['POST',origin,HOSTED_DEMO_MOTION_PATH,issuedAt,nonce,digest].join('\n')).digest('hex');
}
