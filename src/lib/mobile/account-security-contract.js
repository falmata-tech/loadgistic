import { z } from 'zod';
import { createSessionToken, verifySessionToken, privateContactDigest } from '../security.js';
const operation = z.discriminatedUnion('action', [
 z.object({action:z.literal('EMAIL'),email:z.string().trim().toLowerCase().email().max(254)}).strict(),
 z.object({action:z.literal('DEACTIVATE'),confirm:z.literal('DEACTIVATE')}).strict(),
]);
export const nativeSecurityCommand = z.discriminatedUnion('step', [
 z.object({step:z.literal('REQUEST'),operation}).strict(),
 z.object({step:z.literal('CONFIRM'),operation,handoff:z.string().min(1).max(2048),code:z.string().regex(/^\d{6}$/)}).strict(),
 z.object({step:z.literal('CHECK'),operation:z.object({action:z.literal('EMAIL'),email:z.string().trim().toLowerCase().email().max(254)}).strict(),handoff:z.string().min(1).max(2048)}).strict(),
]);
function subject(actorId,operation,phase){
 if(!z.string().uuid().safeParse(actorId).success||!['CURRENT_EMAIL','EMAIL_PENDING'].includes(phase))throw new Error('INVALID_ACCOUNT_SECURITY');
 const parsed=operation.action==='EMAIL'?{action:'EMAIL',email:operation.email}:{action:operation.action,confirm:operation.confirm};
 const valid=nativeSecurityCommand.safeParse({step:'REQUEST',operation:parsed});if(!valid.success)throw new Error('INVALID_ACCOUNT_SECURITY');
 return `native-account-security:${actorId}:${operation.action}:${phase}:${privateContactDigest(operation.action==='EMAIL'?valid.data.operation.email:'DEACTIVATE')}`;
}
export function nativeSecurityHandoff(actorId,operation,phase='CURRENT_EMAIL'){return createSessionToken(subject(actorId,operation,phase),900);}
export function readNativeSecurityHandoff(token,actorId,operation,phase='CURRENT_EMAIL'){
 if(typeof token!=='string'||token.split('.').length!==2)return false;
 try{return verifySessionToken(token)?.sub===subject(actorId,operation,phase);}catch{return false;}
}
