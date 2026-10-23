import {z} from 'zod';
import {createSessionToken,verifySessionToken,privateContactDigest} from './security.js';
export const ACCOUNT_SECURITY_COOKIE='lg_account_security';
export const ACCOUNT_SECURITY_TTL=15*60;
const request=z.discriminatedUnion('action',[
 z.object({action:z.literal('EMAIL'),email:z.string().trim().toLowerCase().email().max(254)}).strict(),
 z.object({action:z.literal('DEACTIVATE'),confirm:z.literal('DEACTIVATE')}).strict()
]);
export function parseAccountSecurityRequest(value){const result=request.safeParse(value);if(!result.success)throw new Error('INVALID_ACCOUNT_SECURITY');return result.data;}
export function accountSecurityHandoff(actorId,action,target,phase='CURRENT_EMAIL'){
 if(!z.string().uuid().safeParse(actorId).success||!['EMAIL','DEACTIVATE'].includes(action)||!['CURRENT_EMAIL','EMAIL_PENDING'].includes(phase))throw new Error('INVALID_ACCOUNT_SECURITY');
 return createSessionToken(`account-security:${actorId}:${action}:${phase}:${privateContactDigest(target)}`,ACCOUNT_SECURITY_TTL);
}
export function readAccountSecurityHandoff(token,actorId,action,target,phase='CURRENT_EMAIL'){
 const payload=verifySessionToken(token);return payload?.sub===`account-security:${actorId}:${action}:${phase}:${privateContactDigest(target)}`;
}
export function accountSecurityIdentity(token){
 const payload=verifySessionToken(token);const parts=String(payload?.sub||'').match(/^account-security:([0-9a-f-]{36}):(EMAIL|DEACTIVATE):(CURRENT_EMAIL|EMAIL_PENDING):([a-f0-9]{64})$/);
 return parts?{actorId:parts[1],action:parts[2],phase:parts[3],targetDigest:parts[4]}:null;
}
